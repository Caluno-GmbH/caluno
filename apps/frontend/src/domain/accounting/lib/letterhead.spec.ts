import { describe, expect, it } from 'bun:test';
import { letterheadLines } from './letterhead';

describe('letterheadLines', () => {
  it('composes name, address, and zip+city lines', () => {
    expect(
      letterheadLines({
        org_name: 'Altonaer Lesepaten',
        org_street: 'Adress eintrag 1',
        org_zip: '22245',
        org_city: 'Berlin',
      }),
    ).toEqual(['Altonaer Lesepaten', 'Adress eintrag 1', '22245 Berlin']);
  });

  it('skips blank org values', () => {
    expect(
      letterheadLines({
        org_name: 'Verein',
        org_street: '   ',
        org_zip: undefined,
        org_city: null as never,
      }),
    ).toEqual(['Verein']);
  });

  it('renders a zip without a city', () => {
    expect(letterheadLines({ org_name: 'V', org_zip: '22245' })).toEqual([
      'V',
      '22245',
    ]);
  });
});
