import * as Sentry from '@sentry/nextjs';

const FEATURE = 'accounting-bundle-download';

interface BundleDownloadContext {
  volunteerId: string;
  reimbursementTypeId: string;
}

/** The message a Nest HTTP exception sends in its JSON body, if there is one. */
async function serverMessage(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'message' in body) {
      const { message } = body;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }
  } catch {
    // Not JSON (e.g. a gateway error page): the status alone is reported.
  }
  return undefined;
}

/**
 * Reports a failed bundle download to Sentry. The coordinator only sees a
 * generic toast, so this is where the reason (status and server message) is
 * kept.
 */
export async function reportBundleDownloadFailure(
  failure: Response | unknown,
  context: BundleDownloadContext,
): Promise<void> {
  if (failure instanceof Response) {
    const message = await serverMessage(failure);
    const error = new Error(
      `Bundle download failed with HTTP ${failure.status}${message ? `: ${message}` : ''}`,
    );
    Sentry.captureException(error, {
      tags: { feature: FEATURE, status: String(failure.status) },
      extra: { ...context },
    });
    return;
  }
  Sentry.captureException(failure, {
    tags: { feature: FEATURE },
    extra: { ...context },
  });
}
