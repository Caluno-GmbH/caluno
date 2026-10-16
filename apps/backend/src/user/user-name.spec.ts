import { describe, expect, it } from 'bun:test';
import {
  effectiveAccountHolder,
  formatUserName,
  normalizeAccountHolderForStorage,
  withEffectiveAccountHolder,
} from './user-name';

describe('formatUserName', () => {
  it('joins first and last with a single space', () => {
    expect(formatUserName('Ada', 'Lovelace')).toBe('Ada Lovelace');
  });
});

describe('effectiveAccountHolder', () => {
  it('uses the derived name when accountHolder is unset', () => {
    expect(
      effectiveAccountHolder({
        firstname: 'Ada',
        lastname: 'Lovelace',
        accountHolder: null,
      }),
    ).toBe('Ada Lovelace');
  });

  it('treats blank / whitespace-only stored values as unset', () => {
    expect(
      effectiveAccountHolder({
        firstname: 'Ada',
        lastname: 'Lovelace',
        accountHolder: '   ',
      }),
    ).toBe('Ada Lovelace');
  });

  it('returns the stored non-blank accountHolder', () => {
    expect(
      effectiveAccountHolder({
        firstname: 'Ada',
        lastname: 'Lovelace',
        accountHolder: 'A. Lovelace Trust',
      }),
    ).toBe('A. Lovelace Trust');
  });

  it('trims a stored accountHolder', () => {
    expect(
      effectiveAccountHolder({
        firstname: 'Ada',
        lastname: 'Lovelace',
        accountHolder: '  Bank Name  ',
      }),
    ).toBe('Bank Name');
  });
});

describe('normalizeAccountHolderForStorage', () => {
  it('stores null for blank input', () => {
    expect(normalizeAccountHolderForStorage('', 'Ada Lovelace')).toBeNull();
    expect(normalizeAccountHolderForStorage(null, 'Ada Lovelace')).toBeNull();
    expect(normalizeAccountHolderForStorage('  ', 'Ada Lovelace')).toBeNull();
  });

  it('stores null when the value equals the derived name', () => {
    expect(
      normalizeAccountHolderForStorage('Ada Lovelace', 'Ada Lovelace'),
    ).toBeNull();
    expect(
      normalizeAccountHolderForStorage('  Ada Lovelace  ', 'Ada Lovelace'),
    ).toBeNull();
  });

  it('stores a trimmed explicit value that differs from the name', () => {
    expect(
      normalizeAccountHolderForStorage('  A. Lovelace Trust  ', 'Ada Lovelace'),
    ).toBe('A. Lovelace Trust');
  });
});

describe('withEffectiveAccountHolder', () => {
  it('replaces a null accountHolder with the derived name', () => {
    expect(
      withEffectiveAccountHolder({
        id: 'u1',
        firstname: 'Ada',
        lastname: 'Lovelace',
        accountHolder: null,
      }),
    ).toEqual({
      id: 'u1',
      firstname: 'Ada',
      lastname: 'Lovelace',
      accountHolder: 'Ada Lovelace',
    });
  });
});
