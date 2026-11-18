import { describe, expect, it } from 'bun:test';
import {
  hasUnknownSubjectPlaceholder,
  isValidEmail,
  maskEmail,
} from './delivery-settings';

describe('maskEmail', () => {
  it('keeps the first two characters and the domain', () => {
    expect(maskEmail('accounting@example.org')).toBe('ac•••@example.org');
  });

  it('never shows a one-character local part', () => {
    expect(maskEmail('a@example.org')).toBe('•••@example.org');
  });

  it('masks a value that is not an address entirely', () => {
    expect(maskEmail('nonsense')).toBe('•••');
  });
});

describe('hasUnknownSubjectPlaceholder', () => {
  it('accepts the known placeholders', () => {
    expect(
      hasUnknownSubjectPlaceholder(
        'Abrechnung {volunteer} – {period} ({type})',
      ),
    ).toBe(false);
  });

  it('flags any other placeholder', () => {
    expect(hasUnknownSubjectPlaceholder('{volunteer} {iban}')).toBe(true);
  });
});

describe('isValidEmail', () => {
  it('accepts an address and rejects anything else', () => {
    expect(isValidEmail('accounting@example.org')).toBe(true);
    expect(isValidEmail('accounting@')).toBe(false);
  });
});
