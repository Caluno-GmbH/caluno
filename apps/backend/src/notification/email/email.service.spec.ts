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

/** Runs `send` with `fetch` stubbed, returning whatever it threw. */
async function sendFailure(
  fetchImpl: () => Promise<Response>,
  to: string,
): Promise<Error | undefined> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl as unknown as typeof fetch;
  try {
    const service = new EmailService(configService() as never);
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
