import { describe, expect, it } from 'bun:test';
import { requireSupportedLocale } from '../require-locale';

function notFoundDigest(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
  return undefined;
}

describe('requireSupportedLocale', () => {
  it('returns supported locales unchanged', () => {
    expect(requireSupportedLocale('en')).toBe('en');
    expect(requireSupportedLocale('de')).toBe('de');
  });

  it('triggers notFound for asset-like segments such as favicon.ico', () => {
    expect(
      notFoundDigest(() => requireSupportedLocale('favicon.ico')),
    ).toContain('404');
  });

  it('triggers notFound for unknown locales', () => {
    expect(notFoundDigest(() => requireSupportedLocale('fr'))).toContain('404');
  });
});
