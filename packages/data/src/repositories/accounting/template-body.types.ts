// Frontend-only narrowing of the backend's opaque `DocumentTemplate.body`
// JSON scalar (see `apps/backend/src/accounting/schemas/document-template.schema.ts`'s
// `DocumentTemplateBody = { header: unknown, blocks: unknown[], footer: unknown }`).
// The backend stores and returns this as untyped JSONB; this file gives the
// document-template builder a real shape to work with on the client side,
// plus conversion helpers to/from the `Record<string, unknown>` shape that
// codegen produces for the `JSON` scalar.
//
// The shapes below are ported from the prototype's
// `apps/frontend/src/domain/accounting/components/template/builder-types.ts`
// (origin/VOLI-676---volunteer-reimbursement) — types only. The prototype's
// mutation helpers (e.g. `updateManualFieldValue`) belong to the builder
// component itself and are intentionally not ported here.

export type DataSourceKey =
  | 'volunteer_first_name'
  | 'volunteer_last_name'
  | 'org_name'
  /**
   * The body the volunteer actually serves at, which can differ from the one
   * that signs the agreement — a local Einrichtung under a parent Verein.
   * Falls back to the organisation's own name when not overridden.
   */
  | 'org_facility_name'
  | 'org_street'
  | 'org_zip'
  | 'org_city'
  | 'org_legal_rep'
  | 'pauschalen_type'
  | 'hourly_rate'
  | 'period_start'
  | 'period_end'
  | 'total_hours'
  | 'total_amount'
  | 'generated_date'
  | 'document_number'
  | 'volunteer_iban'
  | 'volunteer_account_holder'
  | 'volunteer_bic'
  | 'volunteer_street'
  | 'volunteer_zip'
  | 'volunteer_city'
  | 'volunteer_dob'
  | 'volunteer_tax_id'
  | 'contract_period'
  | 'already_received_amount'
  | 'already_received_period'
  | 'yearly_limit_amount';

/** Coordinator-typed once, in the builder — reused verbatim on every document generated from this template. */
export type TemplateFieldValue =
  | { kind: 'bound'; source: DataSourceKey }
  | { kind: 'manual-template'; value: string };

export type TemplateField = {
  id: string;
  value: TemplateFieldValue;
  /** Manual-template fields only: which control to render. Plain text Input if omitted. */
  control?: 'textarea' | 'number' | 'period' | 'unit-tabs';
};

/** One line of preset German legal text with inline fields; can be independently switched off within a locked block. */
export type TemplateLine = {
  id: string;
  /** Literal German text; `{fieldId}` markers are resolved to inline chips at render time. */
  text: string;
  fields: TemplateField[];
  /** Whether this specific line can be turned off even though its parent block is locked. */
  optional: boolean;
  enabled: boolean;
};

export type TemplateTextBlock = {
  kind: 'text';
  id: string;
  /**
   * Literal German heading — documents are always German, never i18n'd. Rendered as-is in the
   * document preview and the generated PDF; the template editor renders its own translated
   * heading instead (`builder-headings.ts`), so interface copy never leaks from here (VOLI-1336).
   */
  title: string;
  /** true = mandatory, no block-level toggle (lines may still have their own `optional` toggle). */
  locked: boolean;
  /** Meaningful only when locked is false. */
  enabled: boolean;
  lines: TemplateLine[];
};

/**
 * What populates the Stundennachweis table's first column — the name of the
 * shift each row's hours came from, the task description written into the
 * volunteer's agreement, or a coordinator-typed custom label.
 *
 * `shift_name` is the only one that differs from row to row; hours tracked
 * without a shift behind them fall back to the agreement's task description.
 */
export type TableFirstColumnSource =
  | 'shift_name'
  | 'agreement_task_description'
  | 'custom';

export type TemplateTableBlock = {
  kind: 'table';
  id: string;
  /** Literal German heading — document content, same interface-versus-document rule as `TemplateTextBlock.title`. */
  title: string;
  locked: true;
  columns: string[];
  /** Placeholder rows shown in the builder preview; real rows come from timesheets at generation time. */
  previewRowCount: number;
  firstColumnSource: TableFirstColumnSource;
  /** Coordinator-typed label shown in the first column when firstColumnSource is 'custom'; ignored otherwise. */
  firstColumnCustomLabel: string;
};

/** A single locked line of plain text with inline bound-field chips — no toggle, no nested card. */
export type TemplateNoteBlock = {
  kind: 'note';
  id: string;
  /** Literal German heading — document content, same interface-versus-document rule as `TemplateTextBlock.title`. */
  title: string;
  locked: true;
  line: TemplateLine;
};

export type TemplateBlock =
  | TemplateTextBlock
  | TemplateTableBlock
  | TemplateNoteBlock;

export type InvoiceNumberFormat =
  | 'date-number'
  | 'date-kostenstelle-number'
  | 'compact-date-number'
  | 'kostenstelle-month-year-number';

export type TemplateHeader = {
  /** Title text, resolved per pauschale type by the caller. */
  titleLines: string[];
  orgIdentityLine?: TemplateLine;
  /** Invoice-only: document number, generation date, optional Kostenstelle — each its own line. Empty for contracts. */
  metaLines: TemplateLine[];
};

export type TemplateFooter = {
  /** "{Place}, {Date}" — Place derived from org address, Date bound to document-creation date. */
  closingLine: TemplateLine;
  /** Whether signature slots are shown — always true today; kept explicit since signing display is still an open decision. */
  showSignatures: boolean;
};

/**
 * Organisation details a coordinator may state by hand instead of taking them
 * from the org unit — for a document whose legal counterpart is not the body
 * the volunteer sits in.
 *
 * Keyed by data source rather than by field, because the letterhead is
 * rendered from resolved values rather than from template fields: overriding
 * a field alone would leave the header naming one organisation while the text
 * named another. An absent or blank entry means "use the organisation's own",
 * which is how clearing the field restores the default.
 */
export type OrgOverrideSource =
  | 'org_name'
  | 'org_facility_name'
  | 'org_street'
  | 'org_zip'
  | 'org_city';

export const ORG_OVERRIDE_SOURCES: readonly OrgOverrideSource[] = [
  'org_name',
  'org_facility_name',
  'org_street',
  'org_zip',
  'org_city',
];

export type OrgOverrides = Partial<Record<OrgOverrideSource, string>>;

export type TemplateDocument = {
  header: TemplateHeader;
  blocks: TemplateBlock[];
  footer: TemplateFooter;
  /** Invoice-only: how the generated document number is formatted. Undefined for contracts. */
  invoiceNumberFormat?: InvoiceNumberFormat;
  /** Coordinator-stated organisation details; absent entries fall back to the org unit. */
  orgOverrides?: OrgOverrides;
};

/**
 * The org values a document renders, with any coordinator override applied.
 * Blank overrides are ignored so an emptied field falls back rather than
 * printing nothing, and `org_facility_name` falls back to the org's own name.
 */
export function applyOrgOverrides<T extends Partial<Record<string, string>>>(
  values: T,
  overrides: OrgOverrides | undefined,
): T {
  const resolved: Record<string, string | undefined> = { ...values };
  resolved.org_facility_name = resolved.org_facility_name ?? resolved.org_name;
  for (const source of ORG_OVERRIDE_SOURCES) {
    const override = overrides?.[source]?.trim();
    if (override) resolved[source] = override;
  }
  return resolved as T;
}

export function serializeTemplateBody(
  document: TemplateDocument,
): Record<string, unknown> {
  return document as unknown as Record<string, unknown>;
}

export function parseTemplateBody(
  raw: Record<string, unknown>,
): TemplateDocument {
  const header = (raw.header ?? {}) as TemplateHeader;
  header.metaLines = header.metaLines ?? [];
  const blocks = (
    Array.isArray(raw.blocks) ? raw.blocks : []
  ) as TemplateBlock[];
  const footer = (raw.footer ?? {}) as TemplateFooter;
  const invoiceNumberFormat = raw.invoiceNumberFormat as
    | InvoiceNumberFormat
    | undefined;
  const orgOverrides = (raw.orgOverrides ?? undefined) as
    | OrgOverrides
    | undefined;
  return { header, blocks, footer, invoiceNumberFormat, orgOverrides };
}
