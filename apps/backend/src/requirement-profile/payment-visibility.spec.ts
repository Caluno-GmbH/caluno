import { describe, expect, it } from 'bun:test';
import { maskRestrictedPaymentData } from './payment-visibility';

describe('maskRestrictedPaymentData', () => {
  it('masks each payment key with its own format in one profile', () => {
    const masked = maskRestrictedPaymentData({
      iban: 'DE89 3704 0044 0532 0130 00',
      bic: 'COBADEFFXXX',
      address: 'Musterstraße 1',
    });
    expect(masked).toEqual({
      iban: 'XXXX XXXX XXXX XXXX XXXX XX',
      bic: 'XXXXXXXXXXX',
      address: 'Musterstraße 1',
    });
  });

  it('leaves empty or absent payment values untouched', () => {
    const masked = maskRestrictedPaymentData({
      iban: '',
      bic: '   ',
      address: 'Musterstraße 1',
    });
    expect(masked).toEqual({
      iban: '',
      bic: '   ',
      address: 'Musterstraße 1',
    });
  });
});
