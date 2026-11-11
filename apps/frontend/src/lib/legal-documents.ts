import type { Locale } from '@repo/data';
import { parseISO } from 'date-fns';
import { API_URL } from '@/lib/constants';
import { formats } from '@/lib/formatting/formats';
import { privacyPolicyPdfUrl } from '@/lib/privacy-policy';
import { termsPdfUrl } from '@/lib/terms';

export type LegalDocumentsSummary = {
  privacyNotice: { lastChangedOn: string };
  terms: { version: string; lastChangedOn: string } | null;
};

// Doubles as the `Profile` translation key of the card title.
export type LegalDocumentKind = 'privacyNotice' | 'termsAndConditions';

export type LegalDocumentCard = {
  kind: LegalDocumentKind;
  href: string;
  lastChangedOn: string | null;
};

/**
 * Last-changed dates of the current legal documents. Resolves `null` on any
 * failure so the profile still links the documents, just without dates.
 */
export async function fetchLegalDocuments(): Promise<LegalDocumentsSummary | null> {
  try {
    const response = await fetch(`${API_URL}/legal/documents`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as LegalDocumentsSummary;
  } catch {
    return null;
  }
}

export function buildLegalDocumentCards(
  summary: LegalDocumentsSummary | null,
  locale: Locale,
): LegalDocumentCard[] {
  return [
    {
      kind: 'privacyNotice',
      href: privacyPolicyPdfUrl(locale),
      lastChangedOn: summary?.privacyNotice.lastChangedOn ?? null,
    },
    {
      kind: 'termsAndConditions',
      href: termsPdfUrl(locale),
      lastChangedOn: summary?.terms?.lastChangedOn ?? null,
    },
  ];
}

// `date` is a calendar day (YYYY-MM-DD), not an instant: pin it to UTC on both
// ends so the server's time zone can never shift it to a neighbouring day.
export function formatLastChanged(date: string, locale: Locale): string {
  return formats(locale).formatDate(parseISO(`${date}T00:00:00Z`), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
