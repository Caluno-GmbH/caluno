import { beforeEach, describe, expect, it, mock } from 'bun:test';

const notFoundMock = mock(() => {
  throw new Error('NEXT_NOT_FOUND');
});

mock.module('next/navigation', () => ({
  notFound: notFoundMock,
}));

const { requireSupportedLocale } = await import('../require-locale');

describe('requireSupportedLocale', () => {
  beforeEach(() => {
    notFoundMock.mockClear();
  });

  it('returns supported locales unchanged', () => {
    expect(requireSupportedLocale('en')).toBe('en');
    expect(requireSupportedLocale('de')).toBe('de');
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('triggers notFound for asset-like segments such as favicon.ico', () => {
    expect(() => requireSupportedLocale('favicon.ico')).toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('triggers notFound for unknown locales', () => {
    expect(() => requireSupportedLocale('fr')).toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
