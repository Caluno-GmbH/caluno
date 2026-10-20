import { beforeEach, describe, expect, it, mock } from 'bun:test';

const captureException = mock((_error: unknown, _context?: unknown) => 'id');
mock.module('@sentry/nextjs', () => ({ captureException }));

const { reportBundleDownloadFailure } = await import(
  './report-bundle-download-failure'
);

const context = { volunteerId: 'vol-1', reimbursementTypeId: 'type-1' };

describe('reportBundleDownloadFailure', () => {
  beforeEach(() => captureException.mockClear());

  it('reports an error response with its status and the message the server sent', async () => {
    const response = new Response(
      JSON.stringify({ statusCode: 400, message: 'No ready documents' }),
      { status: 400 },
    );

    await reportBundleDownloadFailure(response, context);

    const [error, hint] = captureException.mock.calls[0] ?? [];
    expect((error as Error).message).toBe(
      'Bundle download failed with HTTP 400: No ready documents',
    );
    expect(hint).toEqual({
      tags: { feature: 'accounting-bundle-download', status: '400' },
      extra: context,
    });
  });

  it('reports the status alone when the body cannot be read', async () => {
    const response = new Response('<html>gateway</html>', { status: 502 });

    await reportBundleDownloadFailure(response, context);

    const [error] = captureException.mock.calls[0] ?? [];
    expect((error as Error).message).toBe(
      'Bundle download failed with HTTP 502',
    );
  });

  it('reports a thrown error as it is', async () => {
    const thrown = new TypeError('Failed to fetch');

    await reportBundleDownloadFailure(thrown, context);

    expect(captureException).toHaveBeenCalledWith(thrown, {
      tags: { feature: 'accounting-bundle-download' },
      extra: context,
    });
  });
});
