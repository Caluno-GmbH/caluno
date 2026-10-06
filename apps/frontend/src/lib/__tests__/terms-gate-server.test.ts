import { describe, expect, it } from 'bun:test';
import { isTermsGateExempt, stripLocalePrefix } from '../locale-path';

describe('isTermsGateExempt', () => {
  it('exempts accept-terms with and without a locale prefix', () => {
    expect(isTermsGateExempt('/accept-terms')).toBe(true);
    expect(isTermsGateExempt('/de/accept-terms')).toBe(true);
    expect(isTermsGateExempt('/en/accept-terms')).toBe(true);
  });

  it('exempts unsubscribe with and without a locale prefix', () => {
    expect(isTermsGateExempt('/unsubscribe')).toBe(true);
    expect(isTermsGateExempt('/de/unsubscribe')).toBe(true);
  });

  it('does not exempt gated surfaces', () => {
    expect(isTermsGateExempt('/')).toBe(false);
    expect(isTermsGateExempt('/de/admin')).toBe(false);
    expect(isTermsGateExempt('/de/shifts')).toBe(false);
    expect(isTermsGateExempt('/de/unsubscribed')).toBe(false);
  });

  it('handles missing and empty pathnames', () => {
    expect(isTermsGateExempt(null)).toBe(false);
    expect(isTermsGateExempt(undefined)).toBe(false);
    expect(isTermsGateExempt('')).toBe(false);
    expect(isTermsGateExempt('/')).toBe(false);
  });
});

describe('stripLocalePrefix', () => {
  it('strips a single supported locale prefix', () => {
    expect(stripLocalePrefix('/de/admin/shifts')).toBe('/admin/shifts');
    expect(stripLocalePrefix('/en')).toBe('/');
  });

  it('leaves unprefixed paths unchanged', () => {
    expect(stripLocalePrefix('/admin/shifts')).toBe('/admin/shifts');
    expect(stripLocalePrefix('/')).toBe('/');
  });
});
