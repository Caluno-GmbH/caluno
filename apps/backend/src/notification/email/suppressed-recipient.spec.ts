import { describe, expect, it } from 'bun:test';
import { isSuppressedEmailRecipient } from './suppressed-recipient';

describe('isSuppressedEmailRecipient', () => {
  it('suppresses any @*.internal or bare @internal address case-insensitively', () => {
    expect(isSuppressedEmailRecipient('bot@caluno.internal')).toBe(true);
    expect(isSuppressedEmailRecipient('Bot@Caluno.Internal ')).toBe(true);
    expect(isSuppressedEmailRecipient('a@notcaluno.internal')).toBe(true);
    expect(isSuppressedEmailRecipient('a@other-app.internal')).toBe(true);
    expect(isSuppressedEmailRecipient('a@internal')).toBe(true);
    expect(isSuppressedEmailRecipient('A@Internal')).toBe(true);
  });

  it('does not suppress other domains', () => {
    expect(isSuppressedEmailRecipient('demo@caluno.org')).toBe(false);
    expect(isSuppressedEmailRecipient('a@caluno.internal.example.com')).toBe(
      false,
    );
    expect(isSuppressedEmailRecipient('a@notinternal')).toBe(false);
  });
});
