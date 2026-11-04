import type { Locale } from '@repo/data';
import { parseISO } from 'date-fns';
import { API_URL } from '@/lib/constants';
import { formats } from '@/lib/formatting/formats';
import { PRIVACY_POLICY_PDF_URL } from '@/lib/privacy-policy';
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
      href: PRIVACY_POLICY_PDF_URL,
      lastChangedOn: summary?.privacyNotice.lastChangedOn ?? null,
    },
    {
      kind: 'termsAndConditions',
      href: termsPdfUrl(locale),
      lastChangedOn: summary?.terms?.lastChangedOn ?? null,
    },
  ];
}

export function formatLastChanged(date: string, locale: Locale): string {
  return formats(locale).formatDate(parseISO(date), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
