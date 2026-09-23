import { describe, expect, it } from 'bun:test';
import { formatOrgAddress } from './format-address';

describe('formatOrgAddress', () => {
  it('joins street and zip+city with a comma by default', () => {
    expect(
      formatOrgAddress({
        address: 'Musterstraße 1',
        zipCode: '10115',
        city: 'Berlin',
      }),
    ).toBe('Musterstraße 1, 10115 Berlin');
  });

  it('uses the given separator between street and zip/city', () => {
    expect(
      formatOrgAddress(
        {
          address: 'Musterstraße 1',
          zipCode: '10115',
          city: 'Berlin',
        },
        '\n',
      ),
    ).toBe('Musterstraße 1\n10115 Berlin');
  });

  it('skips blank parts', () => {
    expect(formatOrgAddress({ address: '  ', zipCode: '10115' })).toBe('10115');
    expect(formatOrgAddress({ city: 'Berlin' })).toBe('Berlin');
    expect(formatOrgAddress({ address: 'Street', city: 'Berlin' })).toBe(
      'Street, Berlin',
    );
    expect(formatOrgAddress({})).toBe('');
  });

  it('returns empty string for null or undefined parts', () => {
    expect(formatOrgAddress(null)).toBe('');
    expect(formatOrgAddress(undefined)).toBe('');
  });
});
