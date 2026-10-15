import {
  type DataSourceKey,
  isProfileSourceKey,
  PROFILE_SOURCE_TO_PROFILE_KEY,
  type TemplateDocument,
  type TemplateField,
  type TemplateLine,
} from '@repo/data';

export type DerivedFieldKind = 'bound' | 'manual';
export type DerivedFieldProvenance = 'template' | 'profile' | 'gap';

export interface DerivedField {
  /** First field id for this field (its React key, and the manual-override key for manual fields). */
  fieldId: string;
  /** Every template field id bound to this field's source — a bound source may appear on several lines with distinct ids. */
  fieldIds: string[];
  labelKey: string;
  kind: DerivedFieldKind;
  /** Manual fields only: which control the template declares (e.g. `period`), so the modal can render the right editor. */
  source?: DataSourceKey;
  value: string | null;
  provenance: DerivedFieldProvenance;
  /** Manual fields only: which control the template asks for. A freeform block wants a textarea, not a one-line input. */
  control?: TemplateField['control'];
}

function isEditableSource(source: DataSourceKey): boolean {
  return isProfileSourceKey(source);
}

function resolveBoundValue(
  source: DataSourceKey,
  profileData: Record<string, unknown>,
): string | null {
  const profileKey = isProfileSourceKey(source)
    ? PROFILE_SOURCE_TO_PROFILE_KEY[source]
    : undefined;
  if (!profileKey) return null;
  const raw = profileData[profileKey];
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

/**
 * The editable, per-document field list a creation modal renders — exactly the
 * fields the template binds, nothing hardcoded. Manual-template fields prefilled
 * from the template's stored value; volunteer-profile bound fields prefilled from
 * the profile (or the volunteer's name for first/last), else marked gap. Org/rate/
 * generation-time sources are resolved elsewhere at creation and are not
 * per-document editable, so they are excluded.
 *
 * A bound source may be quoted on several lines with distinct field ids (e.g.
 * first name on the "parties" and "payout holder" lines) — the backend renders
 * overrides per field id, so each DerivedField carries every field id bound to
 * its source in `fieldIds`.
 */
export function deriveEditableFields(
  document: TemplateDocument,
  profileData: Record<string, unknown> = {},
): DerivedField[] {
  const fields: DerivedField[] = [];
  const seenFieldIds = new Set<string>();
  const boundBySource = new Map<DataSourceKey, DerivedField>();

  const collect = (line: TemplateLine | undefined) => {
    if (!line || line.enabled === false) return;
    for (const field of line.fields) {
      if (field.value.kind === 'manual-template') {
        if (seenFieldIds.has(field.id)) continue;
        seenFieldIds.add(field.id);
        fields.push({
          fieldId: field.id,
          fieldIds: [field.id],
          labelKey: field.id,
          kind: 'manual',
          control: field.control,
          value: field.value.value || null,
          provenance: 'template',
        });
        continue;
      }

      const source = field.value.source;
      if (!isEditableSource(source)) continue;

      const existing = boundBySource.get(source);
      if (existing) {
        existing.fieldIds.push(field.id);
        continue;
      }

      const value = resolveBoundValue(source, profileData);
      const entry: DerivedField = {
        fieldId: field.id,
        fieldIds: [field.id],
        labelKey: source,
        kind: 'bound',
        source,
        value,
        provenance: value ? 'profile' : 'gap',
      };
      boundBySource.set(source, entry);
      fields.push(entry);
    }
  };

  collect(document.header.orgIdentityLine);
  for (const metaLine of document.header.metaLines) collect(metaLine);
  for (const block of document.blocks) {
    if (block.kind === 'table') continue;
    if (block.kind === 'note') {
      collect(block.line);
    } else if (block.enabled !== false) {
      for (const line of block.lines) collect(line);
    }
  }
  collect(document.footer.closingLine);

  return fields;
}
