import { afterEach, describe, expect, it, mock } from 'bun:test';
import {
  buildLegalDocumentCards,
  fetchLegalDocuments,
  formatLastChanged,
  type LegalDocumentsSummary,
} from '../legal-documents';
import { privacyPolicyPdfUrl } from '../privacy-policy';
import { termsPdfUrl } from '../terms';

const summary: LegalDocumentsSummary = {
  privacyNotice: { lastChangedOn: '2026-09-08' },
  terms: { version: '1.0', lastChangedOn: '2026-10-06' },
};

describe('buildLegalDocumentCards', () => {
  it('builds a privacy notice and a terms card with their dates', () => {
    expect(buildLegalDocumentCards(summary, 'de')).toEqual([
      {
        kind: 'privacyNotice',
        href: privacyPolicyPdfUrl('de'),
        lastChangedOn: '2026-09-08',
      },
      {
        kind: 'termsAndConditions',
        href: termsPdfUrl('de'),
        lastChangedOn: '2026-10-06',
      },
    ]);
  });

  it('links privacy and terms in the given locale', () => {
    const cards = buildLegalDocumentCards(summary, 'en');
    expect(cards[0]?.href).toBe(privacyPolicyPdfUrl('en'));
    expect(cards[1]?.href).toBe(termsPdfUrl('en'));
  });

  it('keeps both cards without dates when the summary is missing', () => {
    const cards = buildLegalDocumentCards(null, 'de');

    expect(cards.map((card) => card.kind)).toEqual([
      'privacyNotice',
      'termsAndConditions',
    ]);
    expect(cards.every((card) => card.lastChangedOn === null)).toBe(true);
  });

  it('keeps the terms card without a date when no terms are published', () => {
    const terms = buildLegalDocumentCards({ ...summary, terms: null }, 'de')[1];

    expect(terms).toEqual({
      kind: 'termsAndConditions',
      href: termsPdfUrl('de'),
      lastChangedOn: null,
    });
  });
});

describe('formatLastChanged', () => {
  it('formats a German date without shifting the day', () => {
    expect(formatLastChanged('2026-09-28', 'de')).toBe('28. Sept. 2026');
  });

  it('keeps the calendar day on a server east of Berlin', () => {
    const originalTz = process.env.TZ;
    process.env.TZ = 'Asia/Bangkok';
    try {
      expect(formatLastChanged('2026-09-08', 'de')).toBe('8. Sept. 2026');
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
  });

  it('formats an English date', () => {
    // en-GB abbreviates September as "Sep" or "Sept" depending on the ICU
    // version bundled with the runtime.
    expect(formatLastChanged('2026-09-28', 'en')).toMatch(/^28 Sept? 2026$/);
  });
});

describe('fetchLegalDocuments', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the summary on success', async () => {
    globalThis.fetch = mock(
      async () => new Response(JSON.stringify(summary)),
    ) as unknown as typeof fetch;

    expect(await fetchLegalDocuments()).toEqual(summary);
  });

  it('returns null when the request fails', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    expect(await fetchLegalDocuments()).toBeNull();
  });

  it('returns null on a server error', async () => {
    globalThis.fetch = mock(
      async () => new Response('boom', { status: 500 }),
    ) as unknown as typeof fetch;

    expect(await fetchLegalDocuments()).toBeNull();
  });
});
