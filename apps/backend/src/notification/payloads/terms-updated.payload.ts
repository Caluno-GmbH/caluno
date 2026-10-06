import type { TermsChangeClass } from '../../terms/enums';

export interface TermsUpdatedPayload {
  version: string;
  class: TermsChangeClass;
  /** Absolute URL a user follows to re-accept (used for major versions). */
  acceptTermsUrl: string;
  recipientUserIds: string[];
}
