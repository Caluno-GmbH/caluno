import { describe, expect, it } from 'bun:test';
import {
  levelForScore,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_PASSWORD_SCORE,
  passwordUserInputs,
} from './index';

describe('password policy rules', () => {
  it('keeps the length floor and score threshold in one place', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(MAX_PASSWORD_LENGTH).toBe(128);
    expect(MIN_PASSWORD_SCORE).toBe(3);
  });

  it('maps zxcvbn scores to the four meter levels', () => {
    expect(levelForScore(0)).toBe(1);
    expect(levelForScore(1)).toBe(1);
    expect(levelForScore(2)).toBe(2);
    expect(levelForScore(3)).toBe(3);
    expect(levelForScore(4)).toBe(4);
  });
});

describe('passwordUserInputs', () => {
  it('collects the email, its local part, and the name fields', () => {
    expect(
      passwordUserInputs({
        email: ' max@example.com ',
        name: 'Max Mustermann',
        firstname: 'Max',
        lastname: 'Mustermann',
      }),
    ).toEqual([
      'max@example.com',
      'Max Mustermann',
      'Max',
      'Mustermann',
      'max',
    ]);
  });

  it('ignores missing, blank, and non-string values', () => {
    expect(passwordUserInputs({ email: 42, name: '  ' })).toEqual([]);
    expect(passwordUserInputs(undefined)).toEqual([]);
  });
});
