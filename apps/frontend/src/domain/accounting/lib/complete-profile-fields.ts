import type { MissingProfileKey } from '@repo/data';
import type { RenderableField } from '../../requirement-form/components/field-renderer';
import { SYSTEM_PROFILE_FIELDS } from '../../requirement-form/system-profile-fields';

/**
 * The complete-profile sheet renders exactly the document's missing profile
 * fields, each required, in SYSTEM_PROFILE_FIELDS order so the address fields
 * stay grouped regardless of the order the backend reports them in.
 */
export function missingFieldsToRenderable(
  missingKeys: readonly MissingProfileKey[],
  labelFor: (labelKey: string) => string,
): RenderableField[] {
  const missing = new Set<string>(missingKeys);
  return SYSTEM_PROFILE_FIELDS.filter((field) => missing.has(field.key)).map(
    (field) => ({
      id: field.key,
      systemKey: field.key,
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

/** "Firstname Lastname" when the names are known, otherwise empty. */
export function accountHolderDefault(names: {
  firstname?: string | null;
  lastname?: string | null;
}): string {
  return [names.firstname?.trim() ?? '', names.lastname?.trim() ?? '']
    .filter(Boolean)
    .join(' ');
}

/**
 * Only missing fields are shown, so everything starts empty — except the
 * account holder, which is prefilled from the volunteer's name.
 */
export function completeProfileDefaultValues(
  missingKeys: readonly MissingProfileKey[],
  names: { firstname?: string | null; lastname?: string | null },
): Record<string, string> {
  return Object.fromEntries(
    missingKeys.map((key) => [
      key,
      key === 'accountHolder' ? accountHolderDefault(names) : '',
    ]),
  );
}
