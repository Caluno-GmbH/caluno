import { describe, expect, it } from 'bun:test';
import { formatUserName, resolveNamesForBackfill } from './user-name';

describe('formatUserName', () => {
  it('joins first and last with a single space', () => {
    expect(formatUserName('Ada', 'Lovelace')).toBe('Ada Lovelace');
  });
});

describe('resolveNamesForBackfill', () => {
  it('keeps both filled parts and syncs name', () => {
    expect(
      resolveNamesForBackfill({
        name: 'Old Name',
        firstname: 'Ada',
        lastname: 'Lovelace',
      }),
    ).toEqual({
      firstname: 'Ada',
      lastname: 'Lovelace',
      name: 'Ada Lovelace',
    });
  });

  it('fills missing lastname from name', () => {
    expect(
      resolveNamesForBackfill({
        name: 'Ada Lovelace',
        firstname: 'Ada',
        lastname: null,
      }),
    ).toEqual({
      firstname: 'Ada',
      lastname: 'Ada Lovelace',
      name: 'Ada Ada Lovelace',
    });
  });

  it('fills missing firstname from name', () => {
    expect(
      resolveNamesForBackfill({
        name: 'Ada Lovelace',
        firstname: '  ',
        lastname: 'Lovelace',
      }),
    ).toEqual({
      firstname: 'Ada Lovelace',
      lastname: 'Lovelace',
      name: 'Ada Lovelace Lovelace',
    });
  });

  it('splits name on first space when both blank', () => {
    expect(
      resolveNamesForBackfill({
        name: 'Ada Lovelace Byron',
        firstname: null,
        lastname: '',
      }),
    ).toEqual({
      firstname: 'Ada',
      lastname: 'Lovelace Byron',
      name: 'Ada Lovelace Byron',
    });
  });

  it('uses Lastname when name has no space', () => {
    expect(
      resolveNamesForBackfill({
        name: 'Madonna',
        firstname: null,
        lastname: null,
      }),
    ).toEqual({
      firstname: 'Madonna',
      lastname: 'Lastname',
      name: 'Madonna Lastname',
    });
  });

  it('trims whitespace-only first/last as blank', () => {
    expect(
      resolveNamesForBackfill({
        name: 'Jane Doe',
        firstname: '  ',
        lastname: '\t',
      }),
    ).toEqual({
      firstname: 'Jane',
      lastname: 'Doe',
      name: 'Jane Doe',
    });
  });
});
