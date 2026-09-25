import { describe, expect, it } from 'bun:test';
import { de, enGB } from 'date-fns/locale';
import { intlLocaleTag, localeDateFns, localeLabel } from './locales';

describe('localeLabel', () => {
  it('returns the display label for a supported locale', () => {
    expect(localeLabel('en')).toBe('English');
    expect(localeLabel('de')).toBe('Deutsch');
  });

  it('passes unknown locale codes through unchanged', () => {
    expect(localeLabel('fr')).toBe('fr');
  });
});

describe('intlLocaleTag', () => {
  it('returns the Intl tag for a supported locale', () => {
    expect(intlLocaleTag('en')).toBe('en-GB');
    expect(intlLocaleTag('de')).toBe('de-DE');
  });

  it('is case-insensitive', () => {
    expect(intlLocaleTag('EN')).toBe('en-GB');
  });

  it('falls back to German for an unknown locale', () => {
    expect(intlLocaleTag('fr')).toBe('de-DE');
  });
});

describe('localeDateFns', () => {
  it('returns the date-fns locale for a supported locale', () => {
    expect(localeDateFns('en')).toBe(enGB);
    expect(localeDateFns('de')).toBe(de);
  });

  it('is case-insensitive', () => {
    expect(localeDateFns('EN')).toBe(enGB);
  });

  it('falls back to German for an unknown locale', () => {
    expect(localeDateFns('fr')).toBe(de);
  });
});
