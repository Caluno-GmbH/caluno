import { describe, expect, it } from 'bun:test';
import { EmailService } from './email.service';

const SCALEWAY_ENV: Record<string, string> = {
  TEM_SECRET_KEY: 'scw-secret-key',
  PROJECT_ID: 'project-1',
  TEM_REGION: 'fr-par',
};

function configService(values: Record<string, string> = SCALEWAY_ENV) {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) {
        throw new Error(`Missing config ${key}`);
      }
      return value;
    },
  };
}

class FastRetryEmailService extends EmailService {
  protected override retryBaseDelayMs = 1;
}

async function runSend(
  fetchImpl: typeof fetch,
  to = 'volunteer@example.com',
): Promise<Error | undefined> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const service = new FastRetryEmailService(configService() as never);
    return await service
      .send({ to, subject: 'Subject', html: '<p>Body</p>' })
      .then(
        () => undefined,
        (error: unknown) => error as Error,
      );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function sendFailure(
  fetchImpl: () => Promise<Response>,
  to: string,
): Promise<Error | undefined> {
  return runSend(fetchImpl as unknown as typeof fetch, to);
}

async function sendWithSequence(responses: Array<() => Promise<Response>>) {
  let calls = 0;
  const error = await runSend((async () => {
    const next = responses[Math.min(calls, responses.length - 1)];
    calls++;
    return next();
  }) as unknown as typeof fetch);
  return { calls, error };
}

describe('EmailService retries', () => {
  it('retries a transport failure and succeeds', async () => {
    const { calls, error } = await sendWithSequence([
      async () => {
        throw new Error('ECONNRESET');
      },
      async () => new Response('{}', { status: 200 }),
    ]);

    expect(error).toBeUndefined();
    expect(calls).toBe(2);
  });

  it('retries 5xx and 429 responses', async () => {
    const { calls, error } = await sendWithSequence([
      async () => new Response('busy', { status: 503 }),
      async () => new Response('slow down', { status: 429 }),
      async () => new Response('{}', { status: 200 }),
    ]);

    expect(error).toBeUndefined();
    expect(calls).toBe(3);
  });

  it('gives up after three attempts and throws the last error', async () => {
    const { calls, error } = await sendWithSequence([
      async () => new Response('down', { status: 502 }),
    ]);

    expect(calls).toBe(3);
    expect(error?.message).toContain('Scaleway responded 502');
  });

  it('retries a request timeout and sends an abort signal', async () => {
    const signals: Array<AbortSignal | null | undefined> = [];
    let calls = 0;
    const error = await runSend((async (_url: unknown, init?: RequestInit) => {
      signals.push(init?.signal);
      calls++;
      if (calls === 1) {
        throw new DOMException('The operation timed out', 'TimeoutError');
      }
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch);

    expect(error).toBeUndefined();
    expect(calls).toBe(2);
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
  });

  it('wraps a failure while reading the error body', async () => {
    const brokenBody = new Response('x', { status: 500 });
    brokenBody.text = async () => {
      throw new Error('socket hang up');
    };
    const { calls, error } = await sendWithSequence([async () => brokenBody]);

    expect(calls).toBe(3);
    expect(error?.message).toContain('Scaleway responded 500');
    expect(error?.message).not.toContain('volunteer@example.com');
  });

  it('does not retry other 4xx responses', async () => {
    const { calls, error } = await sendWithSequence([
      async () => new Response('bad', { status: 400 }),
    ]);

    expect(calls).toBe(1);
    expect(error?.message).toContain('Scaleway responded 400');
  });
});

describe('EmailService error reporting', () => {
  it('surfaces the provider status and reason, and masks the recipient', async () => {
    const error = await sendFailure(
      async () =>
        new Response(JSON.stringify({ message: 'invalid recipient domain' }), {
          status: 400,
        }),
      'system-automated@caluno.internal',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('Scaleway responded 400');
    expect(error?.message).toContain('invalid recipient domain');
    expect(error?.message).toContain('sy***@***.internal');
    expect(error?.message).not.toContain('system-automated@caluno.internal');
  });

  it('reports the transport failure reason and keeps the original error as cause', async () => {
    const cause = new Error('getaddrinfo ENOTFOUND api.scaleway.com');
    const error = await sendFailure(async () => {
      throw cause;
    }, 'volunteer@example.com');

    expect(error?.message).toContain('getaddrinfo ENOTFOUND');
    expect(error?.message).not.toContain('volunteer@example.com');
    expect(error?.cause).toBe(cause);
  });

  it('keeps a multi-line provider body to a single bounded line', async () => {
    const error = await sendFailure(
      async () =>
        new Response(`line one\n\nline two ${'x'.repeat(500)}`, {
          status: 500,
        }),
      'volunteer@example.com',
    );

    expect(error?.message).not.toContain('\n');
    expect(error?.message).toContain('line one line two');
    expect((error?.message ?? '').length).toBeLessThan(500);
  });
});
