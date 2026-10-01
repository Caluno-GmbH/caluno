import { describe, expect, it } from 'bun:test';
import { formatUserName } from './user-name';

describe('formatUserName', () => {
  it('joins first and last with a single space', () => {
    expect(formatUserName('Ada', 'Lovelace')).toBe('Ada Lovelace');
  });
});
