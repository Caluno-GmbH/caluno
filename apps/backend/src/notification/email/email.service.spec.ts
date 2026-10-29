import { describe, expect, it } from 'bun:test';
import { EmailTransportService } from './email-transport.service';

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

async function sendOnce(fetchImpl: typeof fetch, to = 'volunteer@example.com') {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const service = new EmailTransportService(configService() as never);
    return await service.sendOnce({
      to,
      subject: 'Subject',
      html: '<p>Body</p>',
      emailId: 'outbox-1',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe('EmailTransportService', () => {
  it('returns the provider message id on success', async () => {
    const result = await sendOnce(
      async () =>
        new Response(JSON.stringify({ email: { id: 'tem-email-1' } }), {
          status: 200,
        }),
    );

    expect(result).toEqual({ ok: true, providerMessageId: 'tem-email-1' });
  });

  it('classifies 503 and 429 responses as retryable', async () => {
    for (const status of [503, 429]) {
      const result = await sendOnce(
        async () => new Response('busy', { status }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.retryable).toBe(true);
        expect(result.error.message).toContain(`Scaleway responded ${status}`);
      }
    }
  });

  it('classifies other 4xx responses as non-retryable', async () => {
    const result = await sendOnce(
      async () => new Response('bad', { status: 400 }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error.message).toContain('Scaleway responded 400');
    }
  });

  it('treats a request timeout as retryable and sends an abort signal', async () => {
    const signals: Array<AbortSignal | null | undefined> = [];
    const result = await sendOnce((async (
      _url: unknown,
      init?: RequestInit,
    ) => {
      signals.push(init?.signal);
      throw new DOMException('The operation timed out', 'TimeoutError');
    }) as unknown as typeof fetch);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(true);
      expect(result.error.message).toContain('The operation timed out');
    }
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it('sends the outbox id as a correlation header', async () => {
    let requestBody: {
      additional_headers?: Array<{ key: string; value: string }>;
    } = {};

    await sendOnce((async (_url: unknown, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch);

    expect(requestBody.additional_headers).toEqual([
      { key: 'X-Caluno-Email-Id', value: 'outbox-1' },
    ]);
  });

  it('wraps a failure while reading the error body', async () => {
    const brokenBody = new Response('x', { status: 500 });
    brokenBody.text = async () => {
      throw new Error('socket hang up');
    };

    const result = await sendOnce(async () => brokenBody);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(true);
      expect(result.error.message).toContain('Scaleway responded 500');
    }
  });
});

describe('EmailTransportService error reporting', () => {
  it('surfaces the provider status and reason, and masks the recipient', async () => {
    const result = await sendOnce(
      async () =>
        new Response(JSON.stringify({ message: 'invalid recipient domain' }), {
          status: 400,
        }),
      'system-automated@caluno.internal',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Scaleway responded 400');
      expect(result.error.message).toContain('invalid recipient domain');
      expect(result.error.message).toContain('sy***@***.internal');
      expect(result.error.message).not.toContain(
        'system-automated@caluno.internal',
      );
    }
  });

  it('reports the transport failure reason and keeps the original error as cause', async () => {
    const cause = new Error('getaddrinfo ENOTFOUND api.scaleway.com');
    const result = await sendOnce(async () => {
      throw cause;
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('getaddrinfo ENOTFOUND');
      expect(result.error.message).not.toContain('volunteer@example.com');
      expect(result.error.cause).toBe(cause);
    }
  });

  it('keeps a multi-line provider body to a single bounded line', async () => {
    const result = await sendOnce(
      async () =>
        new Response(`line one\n\nline two ${'x'.repeat(500)}`, {
          status: 500,
        }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toContain('\n');
      expect(result.error.message).toContain('line one line two');
      expect(result.error.message.length).toBeLessThan(600);
    }
  });
});
