export class TermsAcceptanceError extends Error {
  constructor() {
    super('Terms and conditions must be accepted');
    this.name = 'TermsAcceptanceError';
  }
}

export function termsAcceptedFromBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false;
  }
  return (body as { termsAccepted?: unknown }).termsAccepted === true;
}

export function assertTermsAccepted(body: unknown): void {
  if (!termsAcceptedFromBody(body)) {
    throw new TermsAcceptanceError();
  }
}
