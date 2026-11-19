import { BundleDeliveryMethod } from '@repo/data';
import { z } from 'zod';
import {
  type DeliveryFormValues,
  type RecipientError,
  recipientError,
  type SubjectError,
  subjectError,
} from './delivery-draft';

export type DeliveryValidationMessages = Record<
  RecipientError | SubjectError,
  string
>;

/**
 * Email fields are only validated while bundles are emailed; under Download
 * they are paused and omitted from the save payload, so stale text there must
 * not block saving the delivery method.
 */
export function createDeliverySettingsSchema(
  messages: DeliveryValidationMessages,
): z.ZodType<DeliveryFormValues, DeliveryFormValues> {
  return z
    .object({
      method: z.nativeEnum(BundleDeliveryMethod),
      recipient: z.string(),
      subject: z.string(),
    })
    .superRefine((values, ctx) => {
      if (values.method !== BundleDeliveryMethod.Email) return;

      const recipient = recipientError(values.recipient, values.method);
      if (recipient) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recipient'],
          message: messages[recipient],
        });
      }

      const subject = subjectError(values.subject);
      if (subject) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subject'],
          message: messages[subject],
        });
      }
    });
}
