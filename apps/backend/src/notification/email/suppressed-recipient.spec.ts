import { describe, expect, it } from 'bun:test';
import { isSuppressedEmailRecipient } from './suppressed-recipient';

describe('isSuppressedEmailRecipient', () => {
  it('suppresses @caluno.internal addresses case-insensitively', () => {
    expect(isSuppressedEmailRecipient('bot@caluno.internal')).toBe(true);
    expect(isSuppressedEmailRecipient('Bot@Caluno.Internal ')).toBe(true);
  });

  it('does not suppress other domains', () => {
    expect(isSuppressedEmailRecipient('demo@caluno.org')).toBe(false);
    expect(isSuppressedEmailRecipient('a@caluno.internal.example.com')).toBe(
      false,
    );
    expect(isSuppressedEmailRecipient('a@notcaluno.internal')).toBe(false);
  });
});
