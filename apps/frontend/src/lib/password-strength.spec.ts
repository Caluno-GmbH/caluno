import { describe, expect, it } from 'bun:test';
import { scorePassword } from './password-strength';

describe('scorePassword', () => {
  it('scores a common password below the policy threshold', async () => {
    const result = await scorePassword('abcd1234', []);

    expect(result.score).toBeLessThan(3);
    expect(result.level).toBe(1);
  });

  it('scores a long password above the policy threshold', async () => {
    const result = await scorePassword('T7#kQ2!mR9xP', []);

    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.level).toBeGreaterThanOrEqual(3);
  });

  it('penalizes passwords derived from the user details', async () => {
    const result = await scorePassword('mustermann-2026', [
      'mustermann',
      'max@example.com',
    ]);

    expect(result.score).toBeLessThan(3);
  });

  it('uses the German dictionary for German words', async () => {
    const result = await scorePassword('Passwort123', []);

    expect(result.score).toBeLessThan(3);
  });
});
