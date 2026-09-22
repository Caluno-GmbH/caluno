import { describe, expect, it } from 'bun:test';
import { otherLocale } from './other-locale';

describe('otherLocale', () => {
  it('returns en when the current locale is de', () => {
    expect(otherLocale('de')).toBe('en');
  });

  it('returns de when the current locale is en', () => {
    expect(otherLocale('en')).toBe('de');
  });

  it('defaults to en for any non-en locale', () => {
    expect(otherLocale('fr')).toBe('de');
  });
});
