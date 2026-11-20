import {
  AccountingSettingSourceKind,
  BundleDeliveryMethod,
  type RawAccountingDeliverySettings,
  type UpdateAccountingDeliverySettingsInput,
} from '@repo/data';
import {
  hasUnknownSubjectPlaceholder,
  isValidEmail,
  MAX_BUNDLE_SUBJECT_LENGTH,
} from './delivery-settings';

type SettingSource = RawAccountingDeliverySettings['deliveryMethodSource'];

/** A value and whether this unit explicitly overrides the inherited one. */
export interface DeliveryField<T> {
  value: T;
  own: boolean;
}

export interface DeliveryDraft {
  method: DeliveryField<BundleDeliveryMethod>;
  recipient: DeliveryField<string>;
  subject: DeliveryField<string>;
}

export interface DeliveryFormValues {
  method: BundleDeliveryMethod;
  recipient: string;
  subject: string;
}

export interface DeliveryOwnFlags {
  method: boolean;
  recipient: boolean;
  subject: boolean;
}

export const RECIPIENT_ERRORS = ['invalidEmail', 'recipientRequired'] as const;
export type RecipientError = (typeof RECIPIENT_ERRORS)[number];

export const SUBJECT_ERRORS = ['unknownPlaceholder', 'tooLong'] as const;
export type SubjectError = (typeof SUBJECT_ERRORS)[number];

/** The editable values; inherited fields start at their effective value. */
export function createDeliveryDraft(
  settings: RawAccountingDeliverySettings,
): DeliveryDraft {
  return {
    method: {
      value: settings.deliveryMethod,
      own:
        settings.deliveryMethodSource.kind === AccountingSettingSourceKind.Own,
    },
    recipient: {
      value: settings.recipientEmail ?? '',
      own:
        settings.recipientEmailSource.kind === AccountingSettingSourceKind.Own,
    },
    subject: {
      value: settings.emailSubject,
      own: settings.emailSubjectSource.kind === AccountingSettingSourceKind.Own,
    },
  };
}

export function draftValues(draft: DeliveryDraft): DeliveryFormValues {
  return {
    method: draft.method.value,
    recipient: draft.recipient.value,
    subject: draft.subject.value,
  };
}

export function ownFlags(draft: DeliveryDraft): DeliveryOwnFlags {
  return {
    method: draft.method.own,
    recipient: draft.recipient.own,
    subject: draft.subject.own,
  };
}

export function draftFromValues(
  values: DeliveryFormValues,
  own: DeliveryOwnFlags,
): DeliveryDraft {
  return {
    method: { value: values.method, own: own.method },
    recipient: { value: values.recipient, own: own.recipient },
    subject: { value: values.subject, own: own.subject },
  };
}

/**
 * Editing a field makes it an override if it differs from the inherited value.
 * Once a unit owns a field, only the explicit Reset clears the override.
 */
export function ownAfterEdit<T>(
  currentOwn: boolean,
  value: T,
  inherited: T,
): boolean {
  return currentOwn || value !== inherited;
}

/** Recipient addresses compare without incidental whitespace. */
export function ownAfterRecipientEdit(
  currentOwn: boolean,
  value: string,
  inherited: string,
): boolean {
  return currentOwn || value.trim() !== inherited.trim();
}

export function isEmailMethod(method: BundleDeliveryMethod): boolean {
  return method === BundleDeliveryMethod.Email;
}

export function isDeliveryDraftDirty(
  initial: DeliveryDraft,
  draft: DeliveryDraft,
  includeEmailFields = true,
): boolean {
  if (initial.method.value !== draft.method.value) return true;
  if (initial.method.own !== draft.method.own) return true;
  if (!includeEmailFields) return false;
  return (
    initial.recipient.value !== draft.recipient.value ||
    initial.recipient.own !== draft.recipient.own ||
    initial.subject.value !== draft.subject.value ||
    initial.subject.own !== draft.subject.own
  );
}

/**
 * Only dirty fields are sent, so merely opening the form never turns an
 * inherited value into an override. `null` explicitly resets to inherited;
 * an empty string is an intentional, stored empty value. Paused email fields
 * are omitted while bundles are downloaded.
 */
export function buildDeliveryUpdate(
  initial: DeliveryDraft,
  draft: DeliveryDraft,
  includeEmailFields = true,
): UpdateAccountingDeliverySettingsInput {
  const input: UpdateAccountingDeliverySettingsInput = {};

  if (
    draft.method.value !== initial.method.value ||
    draft.method.own !== initial.method.own
  ) {
    input.deliveryMethod = draft.method.own ? draft.method.value : null;
  }

  if (includeEmailFields) {
    if (
      draft.recipient.value !== initial.recipient.value ||
      draft.recipient.own !== initial.recipient.own
    ) {
      input.recipientEmail = draft.recipient.own
        ? draft.recipient.value.trim()
        : null;
    }
    if (
      draft.subject.value !== initial.subject.value ||
      draft.subject.own !== initial.subject.own
    ) {
      input.emailSubject = draft.subject.own
        ? draft.subject.value.trim()
        : null;
    }
  }

  return input;
}

export function recipientError(
  value: string,
  method: BundleDeliveryMethod,
): RecipientError | null {
  if (!isEmailMethod(method)) return null;
  const trimmed = value.trim();
  if (!trimmed) return 'recipientRequired';
  return isValidEmail(trimmed) ? null : 'invalidEmail';
}

export function subjectError(value: string): SubjectError | null {
  if (value.length > MAX_BUNDLE_SUBJECT_LENGTH) return 'tooLong';
  if (hasUnknownSubjectPlaceholder(value)) return 'unknownPlaceholder';
  return null;
}

/** Inserts `token` over the selection and reports where the caret belongs. */
export function insertSubjectPlaceholder(
  value: string,
  token: string,
  selectionStart: number | null,
  selectionEnd: number | null,
): { value: string; caret: number } {
  const start = Math.min(selectionStart ?? value.length, value.length);
  const end = Math.min(selectionEnd ?? start, value.length);
  return {
    value: `${value.slice(0, start)}${token}${value.slice(end)}`,
    caret: start + token.length,
  };
}

/**
 * The source shown for a field. An unsaved reset of an own value has no known
 * source name yet; the caller shows the generic inherited label until save.
 */
export function sourceForDisplay(
  source: SettingSource,
  own: boolean,
): SettingSource {
  if (own) {
    return { kind: AccountingSettingSourceKind.Own, sourceName: null };
  }
  if (source.kind === AccountingSettingSourceKind.Own) {
    return {
      kind: AccountingSettingSourceKind.Inherited,
      sourceName: null,
    };
  }
  return source;
}
