import type { RequiredFormTargetType } from '@repo/data';
import type { RequiredForm } from '@repo/data/react';
import type { RequiredFormItem } from './components/required-form-renderer';

type FormSubmission = {
  form?: { id?: string | null } | null;
};

/** Form ids the user has already submitted, derived from their submission history. */
export function buildSubmittedFormIds(
  submissions: FormSubmission[],
): Set<string> {
  return new Set(
    submissions
      .map((s) => s.form?.id)
      .filter((id): id is string => Boolean(id)),
  );
}

/** Map OrganizationUserProfile-anchored form values to fieldId → string for prefills. */
export function buildStoredFieldValues(
  rows: Array<{ fieldId: string; value: string }> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows ?? []) {
    out[row.fieldId] = row.value;
  }
  return out;
}

export type RequiredFormSource = {
  targetType: RequiredFormTargetType;
  targetId: string;
  refs: Array<{ form: RequiredForm; order: number }> | null | undefined;
};

/** Merges required-form refs from multiple targets (e.g. shift + instance + org unit) into one ordered, submitted-tagged list. */
export function resolveRequiredForms(
  sources: RequiredFormSource[],
  submittedFormIds: ReadonlySet<string>,
): RequiredFormItem[] {
  return sources
    .flatMap((source) =>
      (source.refs ?? []).map((ref) => ({
        form: ref.form,
        order: ref.order,
        submitted: submittedFormIds.has(ref.form.id),
        targetType: source.targetType,
        targetId: source.targetId,
      })),
    )
    .sort((a, b) => a.order - b.order);
}

/**
 * Which share token (if any) to use when submitting one item from a
 * RequiredFormRenderer batch. Item-level token wins; a top-level token only
 * applies to a single-form list (legacy share page).
 */
export function resolveShareSubmitToken(
  item: Pick<RequiredFormItem, 'form' | 'shareToken'>,
  topLevelShareToken: string | undefined,
  formsCount: number,
): string | undefined {
  if (item.shareToken) return item.shareToken;
  if (!topLevelShareToken) return undefined;
  return formsCount === 1 ? topLevelShareToken : undefined;
}

/**
 * Non-member share-link list: org-unit required forms, plus the shared form
 * when it is not already required. Shared-only forms carry `shareToken` so
 * they submit via the public token mutation.
 */
export function mergeShareFormWithRequiredForms(options: {
  sharedForm: RequiredForm;
  shareToken: string;
  requiredForms: RequiredFormItem[];
  submittedFormIds: ReadonlySet<string>;
  targetType: RequiredFormTargetType;
  targetId: string;
}): RequiredFormItem[] {
  const {
    sharedForm,
    shareToken,
    requiredForms,
    submittedFormIds,
    targetType,
    targetId,
  } = options;

  if (requiredForms.some((item) => item.form.id === sharedForm.id)) {
    return requiredForms;
  }

  const minOrder =
    requiredForms.length > 0
      ? Math.min(...requiredForms.map((item) => item.order))
      : 0;

  return [
    {
      form: sharedForm,
      order: minOrder - 1,
      submitted: submittedFormIds.has(sharedForm.id),
      targetType,
      targetId,
      shareToken,
    },
    ...requiredForms,
  ];
}
