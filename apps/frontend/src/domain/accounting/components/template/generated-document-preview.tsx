import { Badge, cn, Separator } from '@repo/ui';
import { Fragment, type ReactNode } from 'react';
import { letterheadLines } from '../../lib/letterhead';
import type { DocumentKind, PauschalenType } from '../doc-type-header';
import { DocTypeHeader } from '../doc-type-header';
import type {
  DataSourceKey,
  TemplateDocument,
  TemplateLine,
} from './builder-types';

interface SignatureLineProps {
  label: string;
  unsignedLabel: string;
}

const AMOUNT_COLUMN_LABEL = 'Betrag';

function SignatureLine({ label, unsignedLabel }: SignatureLineProps) {
  return (
    <div>
      <div className="h-10 border-b" />
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{unsignedLabel}</p>
    </div>
  );
}

/**
 * A value that hasn't been resolved.
 * - `plain` (default): a real generated document missing a value it should have had — bare "—".
 * - `source`: not yet known at this stage (e.g. no volunteer selected yet in the template
 *   builder) — expected, rendered as a neutral dashed chip naming the source.
 * - `gap`: a true profile-data gap (never collected) — the amber "warning" convention.
 */
function Gap({
  variant = 'plain',
  label,
}: {
  variant?: 'plain' | 'source' | 'gap';
  label?: string;
}) {
  if (variant === 'plain' || !label) {
    return (
      <span className="rounded border border-dashed border-alert/50 bg-alert/10 px-1 text-alert">
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        'rounded border border-dashed px-1 font-mono text-xs',
        variant === 'gap'
          ? 'border-alert/50 bg-alert/10 text-alert'
          : 'border-muted-foreground/40 text-muted-foreground',
      )}
    >
      {label}
    </span>
  );
}

function resolveField(
  field: TemplateLine['fields'][number],
  values: Partial<Record<DataSourceKey, string>>,
  manualOverrides: Record<string, string>,
): string | undefined {
  if (field.value.kind === 'bound') return values[field.value.source];
  return manualOverrides[field.id] ?? (field.value.value || undefined);
}

/** Which `Gap` variant/label an unresolved bound field gets — `plain` when the caller supplies no labels (the creation modals). */
function unresolvedGapProps(
  field: TemplateLine['fields'][number],
  unresolvedLabels: Partial<Record<DataSourceKey, string>>,
  gapSources: Set<DataSourceKey>,
): { variant: 'plain' | 'source' | 'gap'; label?: string } {
  if (field.value.kind !== 'bound') return { variant: 'plain' };
  const label = unresolvedLabels[field.value.source];
  if (!label) return { variant: 'plain' };
  return {
    variant: gapSources.has(field.value.source) ? 'gap' : 'source',
    label,
  };
}

function LineRow({
  line,
  values,
  manualOverrides,
  unresolvedLabels,
  gapSources,
  inline = false,
}: {
  line: TemplateLine;
  values: Partial<Record<DataSourceKey, string>>;
  manualOverrides: Record<string, string>;
  unresolvedLabels: Partial<Record<DataSourceKey, string>>;
  gapSources: Set<DataSourceKey>;
  // Render as part of a surrounding paragraph rather than as one of its own.
  inline?: boolean;
}) {
  if (!line.enabled) return null;

  // A line that's just one multiline field (the "Sonstiges" freeform block) renders as its own paragraph.
  const [soleField] = line.fields;
  if (
    !inline &&
    line.fields.length === 1 &&
    soleField?.control === 'textarea'
  ) {
    const value = resolveField(soleField, values, manualOverrides);
    return (
      <p className="whitespace-pre-wrap text-base leading-relaxed">
        {value || (
          <Gap
            {...unresolvedGapProps(soleField, unresolvedLabels, gapSources)}
          />
        )}
      </p>
    );
  }

  const parts = line.text.split(/\{[^}]+\}/g);
  const fields = line.fields;
  const Wrapper = inline ? 'span' : 'p';

  return (
    <Wrapper
      className={
        inline ? undefined : 'whitespace-pre-line text-base leading-relaxed'
      }
    >
      {parts.map((part, i) => {
        const field = fields[i];
        const value = field
          ? resolveField(field, values, manualOverrides)
          : undefined;
        return (
          <span key={field?.id ?? 'tail'}>
            {part}
            {field &&
              (value ? (
                value
              ) : (
                <Gap
                  {...unresolvedGapProps(field, unresolvedLabels, gapSources)}
                />
              ))}
          </span>
        );
      })}
    </Wrapper>
  );
}

/**
 * A block's lines grouped into the paragraphs they print. A line marked
 * `inline` continues the one before it.
 */
function paragraphRuns(lines: TemplateLine[]): TemplateLine[][] {
  const runs: TemplateLine[][] = [];
  for (const line of lines) {
    if (!line.enabled) continue;
    const current = runs[runs.length - 1];
    if (line.inline && current) current.push(line);
    else runs.push([line]);
  }
  return runs;
}

interface GeneratedDocumentPreviewProps {
  document: TemplateDocument;
  kind: DocumentKind;
  pauschale: PauschalenType;
  pauschaleLabel: string;
  documentTitle: string;
  orgName: string;
  disclaimerLabel: string;
  signerLeftLabel: string;
  signerRightLabel: string;
  unsignedLabel: string;
  values: Partial<Record<DataSourceKey, string>>;
  /** Live per-document edits (contract lifespan, hours/week) — take priority over the template's own stored manual value. */
  manualOverrides?: Record<string, string>;
  /** Real timesheet rows for the invoice table, replacing the builder's blank preview rows. */
  tableRows?: string[][];
  tableTotalRow?: string[];
  /** A fixed statement row shown under the total row — e.g. the 0% VAT notice, never bold like the total. */
  tableNoteRow?: string[];
  /** The gross payout, closing the table under the VAT notice — bold like the net row. */
  tableGrossRow?: string[];
  /**
   * Label for a bound source with no value yet (e.g. "IBAN (Volunteer)") — used by the
   * template builder, where most sources have no volunteer/period to resolve against.
   * Omit (the creation modals' case) to keep today's bare "—" for any gap.
   */
  unresolvedLabels?: Partial<Record<DataSourceKey, string>>;
  /** Which of `unresolvedLabels`' sources are true profile-data gaps (never collected) — rendered amber instead of neutral. */
  gapSources?: Set<DataSourceKey>;
  className?: string;
}

/**
 * Renders an actual generated document — the same TemplateDocument shape the
 * builder edits, with every bound field resolved to the volunteer/org/period
 * data at hand instead of a builder-thumbnail placeholder chip. Used by both
 * creation modals so what the admin sends is what this preview shows.
 */
export function GeneratedDocumentPreview({
  document: templateDoc,
  kind,
  pauschale,
  pauschaleLabel,
  documentTitle,
  orgName,
  disclaimerLabel,
  signerLeftLabel,
  signerRightLabel,
  unsignedLabel,
  values,
  manualOverrides = {},
  tableRows,
  tableTotalRow,
  tableNoteRow,
  tableGrossRow,
  unresolvedLabels = {},
  gapSources = new Set(),
  className,
}: GeneratedDocumentPreviewProps) {
  const letterhead = letterheadLines(values);
  return (
    <div className={className}>
      {/*
        A4 proportions (1:√2) as a FLOOR, not a fixed height: the zero-width
        float holds an empty document to a full page, while a long one makes the
        page taller instead of spilling its table past the border. The generated
        PDF paginates properly; the preview is one continuous page.
      */}
      <div className="mx-auto w-full max-w-[820px] overflow-hidden break-words rounded-sm border bg-card p-[7%] shadow-sm before:float-left before:h-0 before:w-0 before:pb-[148%] before:content-['']">
        <div className="flex items-start justify-between gap-4">
          <DocTypeHeader
            kind={kind}
            pauschale={pauschale}
            topLine={pauschaleLabel}
            name={documentTitle}
            subline={orgName}
          />
          <Badge variant="outline">{disclaimerLabel}</Badge>
        </div>

        <Separator className="my-6" />

        {/* The paying organisation and the document's own references sit in one
            right-aligned block, matching the generated PDF's letterhead. */}
        {(letterhead.length > 0 || templateDoc.header.metaLines.length > 0) && (
          <div className="space-y-1 text-right">
            {letterhead.length > 0 && (
              <p className="whitespace-pre-line text-sm leading-snug">
                {letterhead.join('\n')}
              </p>
            )}
            {templateDoc.header.metaLines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                values={values}
                manualOverrides={manualOverrides}
                unresolvedLabels={unresolvedLabels}
                gapSources={gapSources}
              />
            ))}
          </div>
        )}

        <div className="mt-4 space-y-1 text-center">
          {templateDoc.header.titleLines.map((titleLine, i) => (
            <p
              key={titleLine}
              className={cn(
                i === 0
                  ? 'text-lg font-bold'
                  : 'text-sm font-semibold text-muted-foreground',
              )}
            >
              {titleLine}
            </p>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {templateDoc.blocks.map((block): ReactNode => {
            if (block.kind === 'table') {
              const rows = tableRows ?? [];
              const columns =
                tableRows !== undefined &&
                block.columns[block.columns.length - 1] !== AMOUNT_COLUMN_LABEL
                  ? [...block.columns, AMOUNT_COLUMN_LABEL]
                  : block.columns;
              return (
                <div key={block.id}>
                  <p className="mb-2 text-sm font-semibold italic text-muted-foreground">
                    {block.title}
                  </p>
                  <table className="w-full border-collapse break-words text-sm">
                    <thead>
                      <tr className="bg-muted">
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="border border-border px-2 py-1 text-left font-medium"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={columns.length}
                            className="border border-border px-2 py-2 text-center text-muted-foreground"
                          >
                            <Gap />
                          </td>
                        </tr>
                      )}
                      {rows.map((row, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: table rows are positional cell strings without identity — placeholder rows are identical by design.
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td
                              key={columns[j] ?? j}
                              className="border border-border px-2 py-1"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {tableTotalRow && (
                        <tr className="font-semibold">
                          {tableTotalRow.map((cell, i) => (
                            <td
                              key={columns[i] ?? cell}
                              className="border border-border px-2 py-1"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      )}
                      {tableNoteRow && (
                        <tr className="text-muted-foreground">
                          {tableNoteRow.map((cell, i) => (
                            <td
                              key={columns[i] ?? cell}
                              className="border border-border px-2 py-1"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      )}
                      {tableGrossRow && (
                        <tr className="font-semibold">
                          {tableGrossRow.map((cell, i) => (
                            <td
                              key={columns[i] ?? cell}
                              className="border border-border px-2 py-1"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            }

            if (block.kind === 'note') {
              return (
                <div key={block.id} className="rounded-md border p-2">
                  <LineRow
                    line={block.line}
                    values={values}
                    manualOverrides={manualOverrides}
                    unresolvedLabels={unresolvedLabels}
                    gapSources={gapSources}
                  />
                </div>
              );
            }

            if (!block.enabled) return null;

            return (
              <div key={block.id}>
                {kind !== 'contract' && (
                  <p className="mb-1 text-sm font-semibold italic text-muted-foreground">
                    {block.title}
                  </p>
                )}
                <div className="space-y-1">
                  {paragraphRuns(block.lines).map((run) =>
                    run.length === 1 && run[0] ? (
                      <LineRow
                        key={run[0].id}
                        line={run[0]}
                        values={values}
                        manualOverrides={manualOverrides}
                        unresolvedLabels={unresolvedLabels}
                        gapSources={gapSources}
                      />
                    ) : (
                      <p
                        key={run[0]?.id}
                        className="whitespace-pre-line text-base leading-relaxed"
                      >
                        {run.map((line) => (
                          <Fragment key={line.id}>
                            <LineRow
                              line={line}
                              values={values}
                              manualOverrides={manualOverrides}
                              unresolvedLabels={unresolvedLabels}
                              gapSources={gapSources}
                              inline
                            />
                          </Fragment>
                        ))}
                      </p>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Separator className="my-6" />

        <LineRow
          line={templateDoc.footer.closingLine}
          values={values}
          manualOverrides={manualOverrides}
          unresolvedLabels={unresolvedLabels}
          gapSources={gapSources}
        />

        {templateDoc.footer.showSignatures && (
          <div className="mt-6 grid grid-cols-2 gap-8">
            <SignatureLine
              label={signerLeftLabel}
              unsignedLabel={unsignedLabel}
            />
            <SignatureLine
              label={signerRightLabel}
              unsignedLabel={unsignedLabel}
            />
          </div>
        )}
      </div>
    </div>
  );
}
