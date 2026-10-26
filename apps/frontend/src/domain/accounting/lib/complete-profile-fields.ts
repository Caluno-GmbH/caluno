import type { MissingProfileKey } from '@repo/data';
import type { RenderableField } from '../../requirement-form/components/field-renderer';
import { PROFILE_FIELDS } from '../../requirement-form/profile-fields';

/**
 * The complete-profile sheet renders exactly the document's missing profile
 * fields, each required, in PROFILE_FIELDS order so the address fields
 * stay grouped regardless of the order the backend reports them in.
 */
export function missingFieldsToRenderable(
  missingKeys: readonly MissingProfileKey[],
  labelFor: (labelKey: string) => string,
): RenderableField[] {
  const missing = new Set<string>(missingKeys);
  return PROFILE_FIELDS.filter((field) => missing.has(field.key)).map(
    (field) => ({
      id: field.key,
      profileKey: field.key,
      type: field.type,
      label: labelFor(field.labelKey),
      required: true,
      description: null,
      placeholder: null,
      options: null,
      documents: [],
      documentLabel: null,
      minAge: null,
    }),
  );
}

/**
 * Only missing fields are shown, so everything starts empty
 */
export function completeProfileDefaultValues(
  missingKeys: readonly MissingProfileKey[],
): Record<string, string> {
  return Object.fromEntries(missingKeys.map((key) => [key, '']));
}
