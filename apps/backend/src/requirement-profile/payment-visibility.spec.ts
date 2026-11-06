import { describe, expect, it } from 'bun:test';
import { maskRestrictedPaymentUserFields } from './payment-visibility';

describe('maskRestrictedPaymentUserFields', () => {
  it('masks each payment field with its own format', () => {
    const masked = maskRestrictedPaymentUserFields({
      iban: 'DE89 3704 0044 0532 0130 00',
      bic: 'COBADEFFXXX',
      accountHolder: 'Ada Lovelace',
      firstname: 'Ada',
    });
    expect(masked).toEqual({
      iban: 'XXXX XXXX XXXX XXXX XXXX XX',
      bic: 'XXXXXXXXXXX',
      accountHolder: 'XXXXXX XXXXXX',
      firstname: 'Ada',
    });
  });

  it('leaves empty or absent payment values untouched', () => {
    const masked = maskRestrictedPaymentUserFields({
      iban: '',
      bic: '   ',
      accountHolder: null,
      firstname: 'Ada',
    });
    expect(masked).toEqual({
      iban: '',
      bic: '   ',
      accountHolder: null,
      firstname: 'Ada',
    });
  });
});
