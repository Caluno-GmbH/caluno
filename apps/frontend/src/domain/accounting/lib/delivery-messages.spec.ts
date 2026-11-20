import { describe, expect, it } from 'bun:test';
import de from '../../../../messages/de.json';
import en from '../../../../messages/en.json';

/**
 * `DeliverySettingsSummary` is the read-only view for admins without
 * `accounting:manage`. It is not rendered by the settings form, so its copy is
 * easy to delete as "unused" while the component still asks for it — which is
 * exactly how the keys below went missing once.
 */
const SUMMARY_KEYS = ['recipientNotSet', 'showRecipient', 'hideRecipient'];

const delivery = (messages: { Accounting: unknown }) =>
  (
    messages.Accounting as {
      settings: { delivery: Record<string, unknown> };
    }
  ).settings.delivery;

describe('Accounting.settings.delivery summary copy', () => {
  it('keeps the read-only summary keys in en', () => {
    for (const key of SUMMARY_KEYS) {
      expect(delivery(en)[key]).toBeTruthy();
    }
  });

  it('keeps the read-only summary keys in de', () => {
    for (const key of SUMMARY_KEYS) {
      expect(delivery(de)[key]).toBeTruthy();
    }
  });
});
