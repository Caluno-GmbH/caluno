import { describe, expect, it } from 'bun:test';
import { BundleDeliveryMethod } from '@repo/data';
import { MAX_BUNDLE_SUBJECT_LENGTH } from './delivery-settings';
import { createDeliverySettingsSchema } from './delivery-settings-schema';

const messages = {
  invalidEmail: 'invalid email',
  recipientRequired: 'recipient required',
  unknownPlaceholder: 'unknown placeholder',
  tooLong: `too long (${MAX_BUNDLE_SUBJECT_LENGTH})`,
};

function validate(values: {
  method: BundleDeliveryMethod;
  recipient: string;
  subject: string;
}) {
  return createDeliverySettingsSchema(messages).safeParse(values);
}

describe('createDeliverySettingsSchema', () => {
  it('accepts a valid email configuration', () => {
    expect(
      validate({
        method: BundleDeliveryMethod.Email,
        recipient: 'accounting@example.org',
        subject: 'Abrechnung {volunteer}',
      }).success,
    ).toBe(true);
  });

  it('requires a recipient when sending by email', () => {
    const result = validate({
      method: BundleDeliveryMethod.Email,
      recipient: '  ',
      subject: 'Abrechnung {volunteer}',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('recipient required');
  });

  it('rejects an invalid recipient', () => {
    const result = validate({
      method: BundleDeliveryMethod.Email,
      recipient: 'nope',
      subject: 'Abrechnung {volunteer}',
    });
    expect(result.error?.issues[0]?.message).toBe('invalid email');
  });

  it('rejects an unknown subject variable', () => {
    const result = validate({
      method: BundleDeliveryMethod.Email,
      recipient: 'accounting@example.org',
      subject: '{volunteer} {iban}',
    });
    expect(result.error?.issues[0]?.message).toBe('unknown placeholder');
  });

  it('rejects a subject over the limit', () => {
    const result = validate({
      method: BundleDeliveryMethod.Email,
      recipient: 'accounting@example.org',
      subject: 'x'.repeat(MAX_BUNDLE_SUBJECT_LENGTH + 1),
    });
    expect(result.error?.issues[0]?.message).toBe(
      `too long (${MAX_BUNDLE_SUBJECT_LENGTH})`,
    );
  });

  it('does not validate paused email fields under Download', () => {
    expect(
      validate({
        method: BundleDeliveryMethod.Download,
        recipient: 'nope',
        subject: '{iban}',
      }).success,
    ).toBe(true);
  });
});
