import { describe, expect, it } from 'bun:test';
import { formatAddress } from './format-address';

// duplicated in the frontend

describe('formatorgStreet', () => {
  it('joins street and zip+city with a comma by default', () => {
    expect(
      formatAddress({
        street: 'Musterstraße 1',
        zipCode: '10115',
        city: 'Berlin',
      }),
    ).toBe('Musterstraße 1, 10115 Berlin');
  });

  it('uses the given separator between street and zip/city', () => {
    expect(
      formatAddress(
        {
          street: 'Musterstraße 1',
          zipCode: '10115',
          city: 'Berlin',
        },
        '\n',
      ),
    ).toBe('Musterstraße 1\n10115 Berlin');
  });

  it('skips blank parts', () => {
    expect(formatAddress({ street: '  ', zipCode: '10115' })).toBe('10115');
    expect(formatAddress({ city: 'Berlin' })).toBe('Berlin');
    expect(formatAddress({ street: 'Street', city: 'Berlin' })).toBe(
      'Street, Berlin',
    );
    expect(formatAddress({})).toBe('');
  });

  it('returns empty string for null or undefined parts', () => {
    expect(formatAddress(null)).toBe('');
    expect(formatAddress(undefined)).toBe('');
  });
});
