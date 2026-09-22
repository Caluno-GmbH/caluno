// The document/block/field shapes are the shared frontend narrowing of the
// backend's opaque `DocumentTemplate.body` JSON, owned by
// `packages/data/src/repositories/accounting/template-body.types.ts` and
// re-exported here so the builder's existing imports keep working. This file
// adds only the builder-side constants and mutation helpers that operate on
// those shapes (the shared package intentionally stays shape-only).
import type {
  DataSourceKey,
  TemplateDocument,
  TemplateField,
  TemplateLine,
} from '@repo/data';

export type {
  DataSourceKey,
  InvoiceNumberFormat,
  TableFirstColumnSource,
  TemplateBlock,
  TemplateDocument,
  TemplateField,
  TemplateFieldValue,
  TemplateFooter,
  TemplateHeader,
  TemplateLine,
  TemplateNoteBlock,
  TemplateTableBlock,
  TemplateTextBlock,
} from '@repo/data';

export const ALWAYS_AVAILABLE_SOURCES: DataSourceKey[] = [
  'volunteer_first_name',
  'volunteer_last_name',
  'org_name',
  'org_address',
  'org_city',
  'org_zip',
  'org_legal_rep',
  'pauschalen_type',
  'hourly_rate',
  'period_start',
  'period_end',
  'total_hours',
  'total_amount',
  'generated_date',
  'document_number',
  'contract_period',
  'already_received_amount',
  'already_received_period',
  'yearly_limit_amount',
];

export const PROFILE_REQUIRED_SOURCES: DataSourceKey[] = [
  'volunteer_iban',
  'volunteer_account_holder',
  'volunteer_bic',
  'volunteer_address',
  'volunteer_dob',
  'volunteer_tax_id',
];

/**
 * Where a bound source's value comes from. Mostly drives the "filled from ..." line shown
 * under the field title when there's no concrete value yet to display — except
 * 'rate_settings', 'organization_profile', and 'yearly_limit', which annotate a value that IS
 * already known (the hourly rate, the org's own identity fields, the statutory yearly cap)
 * with where it came from, since unlike volunteer/generation-time fields it's not self-evident.
 */
export type FieldOrigin =
  | 'volunteer_profile'
  | 'generation_time'
  | 'rate_settings'
  | 'organization_profile'
  | 'yearly_limit';

export const FIELD_ORIGIN: Partial<Record<DataSourceKey, FieldOrigin>> = {
  volunteer_first_name: 'volunteer_profile',
  volunteer_last_name: 'volunteer_profile',
  volunteer_iban: 'volunteer_profile',
  volunteer_account_holder: 'volunteer_profile',
  volunteer_bic: 'volunteer_profile',
  volunteer_address: 'volunteer_profile',
  volunteer_dob: 'volunteer_profile',
  volunteer_tax_id: 'volunteer_profile',
  generated_date: 'generation_time',
  document_number: 'generation_time',
  period_start: 'generation_time',
  period_end: 'generation_time',
  total_hours: 'generation_time',
  total_amount: 'generation_time',
  contract_period: 'generation_time',
  already_received_amount: 'generation_time',
  already_received_period: 'generation_time',
  hourly_rate: 'rate_settings',
  org_name: 'organization_profile',
  org_address: 'organization_profile',
  org_city: 'organization_profile',
  org_zip: 'organization_profile',
  org_legal_rep: 'organization_profile',
  yearly_limit_amount: 'yearly_limit',
};

/**
 * Every (line, field) pair actually live in the document right now, in reading order —
 * header, then blocks top to bottom, then footer. Skips lines belonging to a text block
 * that's switched off (locked blocks are always active); those lines aren't rendered
 * anywhere in the editor, so their fields shouldn't count as missing or claim a "first
 * occurrence" slot either.
 */
function allLines(doc: TemplateDocument): TemplateLine[] {
  const lines = [doc.header.orgIdentityLine, ...(doc.header.metaLines ?? [])];
  for (const block of doc.blocks) {
    if (block.kind === 'text' && (block.locked || block.enabled)) {
      lines.push(...block.lines);
    }
  }
  lines.push(doc.footer.closingLine);
  return lines;
}

function mapFields(
  fields: TemplateField[],
  fieldId: string,
  value: string,
): TemplateField[] {
  return fields.map((f) =>
    f.id === fieldId && f.value.kind === 'manual-template'
      ? { ...f, value: { kind: 'manual-template' as const, value } }
      : f,
  );
}

function mapLines(
  lines: TemplateLine[],
  fieldId: string,
  value: string,
): TemplateLine[] {
  return lines.map((l) => ({
    ...l,
    fields: mapFields(l.fields, fieldId, value),
  }));
}

/** Reads a manual-template field's stored value, e.g. the template's baked-in hours unit — undefined if the field doesn't exist or isn't manual. */
export function getManualFieldValue(
  doc: TemplateDocument,
  fieldId: string,
): string | undefined {
  for (const line of allLines(doc)) {
    for (const field of line.fields) {
      if (field.id === fieldId && field.value.kind === 'manual-template') {
        return field.value.value;
      }
    }
  }
  return undefined;
}

/**
 * Sets a manual-template field's value everywhere it's quoted in the document — not just the
 * line the coordinator is editing. Most manual fields only ever appear once, so this is a no-op
 * beyond that one line; the contract's shared "Contract's Lifespan" is the field this exists for.
 */
export function updateManualFieldValue(
  doc: TemplateDocument,
  fieldId: string,
  value: string,
): TemplateDocument {
  return {
    ...doc,
    header: {
      ...doc.header,
      orgIdentityLine: {
        ...doc.header.orgIdentityLine,
        fields: mapFields(doc.header.orgIdentityLine.fields, fieldId, value),
      },
      metaLines: mapLines(doc.header.metaLines, fieldId, value),
    },
    blocks: doc.blocks.map((b) =>
      b.kind === 'text'
        ? { ...b, lines: mapLines(b.lines, fieldId, value) }
        : b,
    ),
    footer: {
      ...doc.footer,
      closingLine: {
        ...doc.footer.closingLine,
        fields: mapFields(doc.footer.closingLine.fields, fieldId, value),
      },
    },
  };
}

/**
 * A manual-template field id can appear on more than one line (e.g. the contract's shared
 * "Contract's Lifespan" constant, quoted once in "Zeitraum" and again in "Freiwillige Stunden").
 * It's edited in exactly one place — this maps each such id to the line it's first editable on;
 * every other occurrence renders read-only.
 */
export function getFirstOccurrenceLineByFieldId(
  doc: TemplateDocument,
): Map<string, string> {
  const firstLineByFieldId = new Map<string, string>();
  for (const line of allLines(doc)) {
    for (const field of line.fields) {
      if (
        field.value.kind === 'manual-template' &&
        !firstLineByFieldId.has(field.id)
      ) {
        firstLineByFieldId.set(field.id, line.id);
      }
    }
  }
  return firstLineByFieldId;
}

/** Manual-template fields left blank on lines/blocks currently switched on — gates the Save button. Counts each field id once even if it's quoted on multiple lines. */
export function countIncompleteManualFields(doc: TemplateDocument): number {
  const seen = new Set<string>();
  let count = 0;
  for (const line of allLines(doc)) {
    if (!line.enabled) continue;
    for (const field of line.fields) {
      if (field.value.kind !== 'manual-template') continue;
      if (seen.has(field.id)) continue;
      seen.add(field.id);
      if (!field.value.value.trim()) count++;
    }
  }
  // The table's first-column label is only a manual value the coordinator must fill in
  // when they've chosen 'custom' — the other source needs nothing typed in.
  for (const block of doc.blocks) {
    if (
      block.kind === 'table' &&
      block.firstColumnSource === 'custom' &&
      !block.firstColumnCustomLabel.trim()
    ) {
      count++;
    }
  }
  return count;
}

/** Org-profile data sources the document gate actually enforces (name always present). */
const ORG_PROFILE_REQUIRED_SOURCES: DataSourceKey[] = [
  'org_address',
  'org_city',
  'org_zip',
  'org_legal_rep',
];

/**
 * The org-profile sources bound on enabled lines/blocks that the org unit is
 * currently missing. Mirrors the backend's `missingOrgProfileSources` gate so
 * the template builder can block Save up front and point the coordinator at the
 * unit's edit sheet instead of failing the request.
 */
export function missingOrgProfileSourcesForOrg(
  doc: TemplateDocument,
  org: {
    address?: string | null;
    city?: string | null;
    zipCode?: string | null;
    legalRep?: string | null;
  },
): DataSourceKey[] {
  const bound = new Set<DataSourceKey>();

  const collectLine = (line: TemplateLine | undefined) => {
    if (!line || line.enabled === false) return;
    for (const field of line.fields) {
      if (
        field.value.kind === 'bound' &&
        ORG_PROFILE_REQUIRED_SOURCES.includes(field.value.source)
      ) {
        bound.add(field.value.source);
      }
    }
  };

  collectLine(doc.header.orgIdentityLine);
  for (const metaLine of doc.header.metaLines) collectLine(metaLine);
  for (const block of doc.blocks) {
    if (block.kind === 'table') continue;
    if (block.kind === 'note') {
      collectLine(block.line);
    } else if (block.kind === 'text' && block.enabled !== false) {
      for (const line of block.lines) collectLine(line);
    }
  }
  collectLine(doc.footer.closingLine);

  const valueBySource: Partial<
    Record<DataSourceKey, string | null | undefined>
  > = {
    org_address: org.address,
    org_city: org.city,
    org_zip: org.zipCode,
    org_legal_rep: org.legalRep,
  };

  return [...bound].filter((source) => {
    const value = valueBySource[source];
    return typeof value !== 'string' || value.trim() === '';
  });
}

// ---------------------------------------------------------------------------
// PROTOTYPE (VOLI-1443) — organisation-data override
//
// Throwaway: explores how a default/manual toggle on the org identity fields
// feels before the real implementation, which waits on VOLI-1351 restructuring
// the invoice header. Not intended to ship as-is.
//
// A logical builder field (e.g. "Organisationsname") can be quoted by several
// template field ids — the letterhead and the parties sentence each carry their
// own. One toggle drives the whole group, so the document can never name the org
// one way in the header and another in the contract text.
// ---------------------------------------------------------------------------

export interface OrgOverrideGroup {
  /** Every template field id that quotes this logical field. */
  fieldIds: string[];
  /** The org-profile source it falls back to when the toggle is off. */
  source: DataSourceKey;
}

export const ORG_OVERRIDE_GROUPS = {
  orgName: {
    fieldIds: ['header-org-name', 'parties-org-name'],
    source: 'org_name',
  },
  orgAddress: {
    fieldIds: ['header-org-address', 'parties-org-address'],
    source: 'org_address',
  },
  // Deliberately separate from orgName: where the volunteer serves can differ
  // from who signs the contract.
  einrichtung: { fieldIds: ['engagement-org-name'], source: 'org_name' },
  ort: { fieldIds: ['closing-place'], source: 'org_city' },
} satisfies Record<string, OrgOverrideGroup>;

export function orgOverrideGroupFor(
  fieldId: string,
): OrgOverrideGroup | undefined {
  return Object.values(ORG_OVERRIDE_GROUPS).find((group) =>
    group.fieldIds.includes(fieldId),
  );
}

/**
 * The group key a field belongs to, used to render exactly one card per logical
 * field. Deduping by data source would be wrong here: Organisationsname and
 * Einrichtung both read `org_name`, and collapsing them would hide the very
 * distinction this feature exists to give the coordinator.
 */
export function orgOverrideGroupKeyFor(fieldId: string): string | undefined {
  return Object.entries(ORG_OVERRIDE_GROUPS).find(([, group]) =>
    group.fieldIds.includes(fieldId),
  )?.[0];
}

/** Manual fields that belong in the contract editor's organisation section. */
export const ORG_SECTION_MANUAL_FIELD_IDS = ['parties-additional-info'];

/** True when this field is currently overridden — i.e. carries a manual value in place of its source. */
export function isOrgFieldOverridden(
  doc: TemplateDocument,
  fieldId: string,
): boolean {
  for (const line of allLines(doc)) {
    for (const field of line.fields) {
      if (field.id === fieldId) return field.value.kind === 'manual-template';
    }
  }
  return false;
}

function mapAllFields(
  doc: TemplateDocument,
  fn: (field: TemplateField) => TemplateField,
): TemplateDocument {
  const mapLine = (line: TemplateLine): TemplateLine => ({
    ...line,
    fields: line.fields.map(fn),
  });
  return {
    ...doc,
    header: {
      ...doc.header,
      orgIdentityLine: mapLine(doc.header.orgIdentityLine),
      metaLines: doc.header.metaLines.map(mapLine),
    },
    blocks: doc.blocks.map((block) => {
      if (block.kind === 'text') {
        return { ...block, lines: block.lines.map(mapLine) };
      }
      if (block.kind === 'note') return { ...block, line: mapLine(block.line) };
      return block;
    }),
    footer: { ...doc.footer, closingLine: mapLine(doc.footer.closingLine) },
  };
}

/**
 * Flips every field id in the group between its bound source and a manual value.
 *
 * Switching on prefills with the org's current value, so the coordinator edits
 * from something sensible rather than an empty box. Switching off discards the
 * manual text and restores the binding, so the field tracks the org profile
 * again — that is the whole point of a toggle over a pencil.
 */
export function setOrgFieldOverride(
  doc: TemplateDocument,
  fieldId: string,
  overridden: boolean,
  prefill: string,
): TemplateDocument {
  const group = orgOverrideGroupFor(fieldId);
  if (!group) return doc;

  return mapAllFields(doc, (field) => {
    if (!group.fieldIds.includes(field.id)) return field;
    return {
      ...field,
      value: overridden
        ? { kind: 'manual-template' as const, value: prefill }
        : { kind: 'bound' as const, source: group.source },
    };
  });
}
