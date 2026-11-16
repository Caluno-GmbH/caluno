import { describe, expect, it } from 'bun:test';
import {
  formatBundlePeriod,
  renderBundleSubject,
  unknownSubjectPlaceholders,
} from './bundle-email-subject';

describe('unknownSubjectPlaceholders', () => {
  it('accepts the known placeholders', () => {
    expect(
      unknownSubjectPlaceholders('Abrechnung {volunteer} – {period} ({type})'),
    ).toEqual([]);
  });

  it('names every unknown placeholder', () => {
    expect(unknownSubjectPlaceholders('{volunteer} {iban} {}')).toEqual([
      'iban',
      '',
    ]);
  });
});

describe('renderBundleSubject', () => {
  const values = {
    volunteer: 'Jana Muster',
    period: 'Oktober 2026',
    type: 'Ehrenamtspauschale',
  };

  it('fills every placeholder', () => {
    expect(
      renderBundleSubject('Abrechnung {volunteer} – {period} ({type})', values),
    ).toBe('Abrechnung Jana Muster – Oktober 2026 (Ehrenamtspauschale)');
  });

  it('folds line breaks so the header cannot be split', () => {
    expect(
      renderBundleSubject('{volunteer}', { ...values, volunteer: 'A\r\nB' }),
    ).toBe('A B');
  });
});

describe('formatBundlePeriod', () => {
  // Berlin midnight on the 1st, as billing periods are stored.
  const september = new Date('2026-08-31T22:00:00.000Z');
  const october = new Date('2026-09-30T22:00:00.000Z');

  it('names a single month once', () => {
    expect(formatBundlePeriod([october, october], 'de')).toBe('Oktober 2026');
  });

  it('joins the first and last month, whatever the order', () => {
    expect(formatBundlePeriod([october, september], 'de')).toBe(
      'September 2026 – Oktober 2026',
    );
  });
});
