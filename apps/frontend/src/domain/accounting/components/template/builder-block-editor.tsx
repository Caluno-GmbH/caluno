'use client';

import {
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui';
import { LockIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { createContext, useContext, useId } from 'react';
import type { DocumentKind } from '../doc-type-header';
import { InfoPanel } from '../info-panel';
import { blockHeadingKey } from './builder-headings';
import { TemplateBuilderPeriodPicker } from './builder-period-picker';
import {
  type DataSourceKey,
  FIELD_ORIGIN,
  type FieldOrigin,
  getFirstOccurrenceLineByFieldId,
  getManualFieldValue,
  type InvoiceNumberFormat,
  isOrgFieldOverridden,
  joinAddressValue,
  ORG_OVERRIDE_GROUPS,
  ORG_SECTION_MANUAL_FIELD_IDS,
  orgOverrideGroupFor,
  orgOverrideGroupKeyFor,
  setOrgFieldOverride,
  splitAddressValue,
  type TableFirstColumnSource,
  type TemplateBlock,
  type TemplateDocument,
  type TemplateField,
  type TemplateLine,
  type TemplateTableBlock,
  type TemplateTextBlock,
  updateManualFieldValue,
} from './builder-types';

/**
 * Contract-only editor grouping — deliberately NOT 1:1 with the document's own paragraph
 * blocks. The legal text stays organized by clause; the editor groups the same fields by
 * what a coordinator is actually filling in (org info, volunteer info, engagement terms).
 */
const ORG_SOURCES: DataSourceKey[] = [
  'org_name',
  'org_address',
  'org_city',
  'org_zip',
  'org_legal_rep',
];
const VOLUNTEER_SOURCES: DataSourceKey[] = [
  'volunteer_first_name',
  'volunteer_last_name',
  'volunteer_address',
  'volunteer_dob',
  'volunteer_iban',
  'volunteer_account_holder',
  'volunteer_bic',
];
const ENGAGEMENT_SOURCES: DataSourceKey[] = ['hourly_rate'];
const ENGAGEMENT_MANUAL_FIELD_IDS = ['contract-lifespan', 'tasks'];

interface EditorFieldEntry {
  field: TemplateField;
  line: TemplateLine;
  blockId: string;
}

/** The hours-per-{unit} line's two manual fields, rendered together in one card by `HoursFieldCard` instead of as two separate generic field rows. */
export interface HoursEditorEntry {
  line: TemplateLine;
  unitField: TemplateField;
  amountField: TemplateField;
}

export interface ContractEditorGroups {
  org: EditorFieldEntry[];
  /** The signature place, rendered at the foot of the panel where it appears in the document. */
  signaturePlace: EditorFieldEntry | undefined;
  volunteer: EditorFieldEntry[];
  engagement: EditorFieldEntry[];
  hours: HoursEditorEntry | undefined;
  extraBlock: TemplateTextBlock | undefined;
}

export function collectContractEditorGroups(
  doc: TemplateDocument,
): ContractEditorGroups {
  const org: EditorFieldEntry[] = [];
  const volunteer: EditorFieldEntry[] = [];
  const engagement: EditorFieldEntry[] = [];
  const seenSources = new Set<DataSourceKey>();
  const seenManualIds = new Set<string>();
  const seenOverrideGroups = new Set<string>();
  let extraBlock: TemplateTextBlock | undefined;
  let signaturePlace: EditorFieldEntry | undefined;
  let hours: HoursEditorEntry | undefined;
  let hoursUnitField: TemplateField | undefined;

  for (const block of doc.blocks) {
    if (block.kind !== 'text') continue;
    if (block.id === 'sonstiges') {
      extraBlock = block;
      continue;
    }
    for (const line of block.lines) {
      for (const field of line.fields) {
        if (field.id === 'hours-unit') {
          hoursUnitField = field;
          continue;
        }
        if (field.id === 'hours-amount') {
          if (hoursUnitField) {
            hours = { line, unitField: hoursUnitField, amountField: field };
          }
          continue;
        }
        const entry: EditorFieldEntry = { field, line, blockId: block.id };

        const overrideKey = orgOverrideGroupKeyFor(field.id);
        if (overrideKey) {
          if (seenOverrideGroups.has(overrideKey)) continue;
          seenOverrideGroups.add(overrideKey);
          org.push(entry);
          continue;
        }

        if (field.value.kind === 'bound') {
          const source = field.value.source;
          if (seenSources.has(source)) continue;
          if (ORG_SOURCES.includes(source)) {
            seenSources.add(source);
            org.push(entry);
          } else if (VOLUNTEER_SOURCES.includes(source)) {
            seenSources.add(source);
            volunteer.push(entry);
          } else if (ENGAGEMENT_SOURCES.includes(source)) {
            seenSources.add(source);
            engagement.push(entry);
          }
        } else {
          if (seenManualIds.has(field.id)) continue;
          if (ORG_SECTION_MANUAL_FIELD_IDS.includes(field.id)) {
            seenManualIds.add(field.id);
            org.push(entry);
          } else if (ENGAGEMENT_MANUAL_FIELD_IDS.includes(field.id)) {
            seenManualIds.add(field.id);
            engagement.push(entry);
          }
        }
      }
    }
  }

  // The signature place lives in the footer's closing line, which the block walk
  // above never visits. Surface it only once the address is overridden: while the
  // organisation's own address is in use the place follows from it, but a manually
  // named counterparty may well sign somewhere else, and leaving the sub-org's town
  // under the signature would contradict the address printed above it.
  const addressOverridden = ORG_OVERRIDE_GROUPS.orgAddress.fieldIds.some((id) =>
    isOrgFieldOverridden(doc, id),
  );
  if (addressOverridden) {
    for (const field of doc.footer.closingLine.fields) {
      const key = orgOverrideGroupKeyFor(field.id);
      if (!key || seenOverrideGroups.has(key)) continue;
      seenOverrideGroups.add(key);
      signaturePlace = {
        field,
        line: doc.footer.closingLine,
        blockId: 'footer',
      };
    }
  }

  return { org, volunteer, engagement, hours, extraBlock, signaturePlace };
}

const INVOICE_NUMBER_FORMATS: InvoiceNumberFormat[] = [
  'date-number',
  'date-kostenstelle-number',
  'compact-date-number',
  'kostenstelle-month-year-number',
];

function updateLineEnabled(
  lines: TemplateLine[],
  lineId: string,
  enabled: boolean,
): TemplateLine[] {
  return lines.map((l) => (l.id === lineId ? { ...l, enabled } : l));
}

const SECTION_TITLE_CLASSNAME = 'text-lg font-semibold text-foreground';

/**
 * Example content for a bound source with no value yet — reads like what will actually be
 * there, not the field's own label.
 *
 * Two classes live here, split by the interface-versus-document rule (VOLI-1336):
 * - Format examples are document content (a German address, German date format, German amount),
 *   so they stay German regardless of the coordinator's language — they preview the document.
 * - Language-dependent examples that would otherwise read as a German *label* in an English
 *   interface (a first/last name) come from the catalog instead, via `PLACEHOLDER_EXAMPLE_KEYS`.
 */
const PLACEHOLDER_EXAMPLES: Partial<Record<DataSourceKey, string>> = {
  volunteer_address: 'Musterstraße 1, 12345 Stadt',
  org_zip: '12345',
  volunteer_dob: 'TT.MM.JJJJ',
  volunteer_iban: 'DE00 0000 0000 0000 0000 00',
  volunteer_bic: 'XXXXXXXX',
  volunteer_tax_id: 'XX XXX XXX XXX',
  period_start: 'TT.MM.JJJJ',
  period_end: 'TT.MM.JJJJ',
  total_hours: '0',
  total_amount: '0,00 €',
  generated_date: 'TT.MM.JJJJ',
  document_number: 'XXXX-XXX',
};

/** Bound sources whose placeholder is interface copy and follows the coordinator's language. */
const PLACEHOLDER_EXAMPLE_KEYS: Partial<Record<DataSourceKey, string>> = {
  volunteer_first_name: 'blockEditor.placeholderExamples.volunteer_first_name',
  volunteer_last_name: 'blockEditor.placeholderExamples.volunteer_last_name',
  volunteer_account_holder:
    'blockEditor.placeholderExamples.volunteer_account_holder',
};

function placeholderExampleFor(
  source: DataSourceKey,
  fallback: string,
  t: ReturnType<typeof useTranslations>,
): string {
  const key = PLACEHOLDER_EXAMPLE_KEYS[source];
  if (key) return t(key as Parameters<typeof t>[0]);
  return PLACEHOLDER_EXAMPLES[source] ?? fallback;
}

/** A field's display title — same lookup bound/manual fields use everywhere, shared so a parent (e.g. an optional line's header row) can render it once instead of duplicating it inside FieldRow. */
function getFieldTitle(
  field: TemplateField,
  t: ReturnType<typeof useTranslations>,
): string {
  // An overridable org field keeps one title across the toggle. Falling through to
  // the generic lookup would rename it the moment it flipped kind — bound fields are
  // titled by data source, manual ones by field id — and the source-derived title is
  // wrong anyway where two fields share a source (Organisationsname vs Einrichtung).
  const overrideKey = orgOverrideGroupKeyFor(field.id);
  if (overrideKey) {
    return t(`orgOverrideLabels.${overrideKey}` as Parameters<typeof t>[0]);
  }
  return field.value.kind === 'bound'
    ? t(`dataSources.${field.value.source}` as Parameters<typeof t>[0])
    : t(`manualFieldLabels.${field.id}` as Parameters<typeof t>[0]);
}

interface FieldRowProps {
  field: TemplateField;
  line: TemplateLine;
  firstOccurrenceByFieldId: Map<string, string>;
  profileGaps: Set<DataSourceKey>;
  knownValues: Partial<Record<DataSourceKey, string>>;
  typeLabel: string;
  onManualChange: (fieldId: string, value: string) => void;
  /** Skip rendering the title/badge — a parent (optional-line header row) already rendered it. */
  hideTitle?: boolean;
}

/** Amber "profile data was never collected" badge — shared by a bound field's own card and its parent optional-line card. */
function ProfileGapBadge({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-alert/30 bg-alert/15 px-2 py-0.5 text-xs font-medium text-alert">
      <TriangleAlertIcon size={12} aria-hidden="true" />
      {t('fieldList.requiresCollection')}
    </span>
  );
}

function sourceLabelKey(origin: FieldOrigin | undefined): string {
  switch (origin) {
    case 'organization_profile':
      return 'fieldSource.organizationProfile';
    case 'rate_settings':
      return 'fieldSource.rateSettings';
    case 'yearly_limit':
      return 'fieldSource.yearlyLimit';
    case 'generation_time':
      return 'fieldSource.generationTime';
    case 'volunteer_profile':
      return 'fieldSource.volunteerProfile';
    default:
      return 'fieldSource.volunteerProfile';
  }
}

/**
 * PROTOTYPE (VOLI-1443). Lets a deeply nested FieldRow flip an org field between
 * its bound source and a manual value without threading a callback through four
 * levels of editor props. A real implementation would decide whether this is the
 * right seam; for a throwaway it keeps the diff honest and small.
 */
interface OrgOverrideApi {
  toggle: (fieldId: string, overridden: boolean, prefill: string) => void;
  /** The value a split group edits as one field, rejoined from its document slots. */
  joinedValue: (fieldId: string) => string | undefined;
}

const OrgOverrideContext = createContext<OrgOverrideApi | null>(null);

function OrgOverrideSwitch({
  fieldId,
  usingOrgData,
  prefill,
  label,
}: {
  fieldId: string;
  /** ON = take the value from the organisation profile. This is the default. */
  usingOrgData: boolean;
  prefill: string;
  label: string;
}) {
  const t = useTranslations('Accounting.templates.builder');
  const api = useContext(OrgOverrideContext);
  if (!api) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {t('fieldSource.useOrgData')}
      </span>
      <Switch
        checked={usingOrgData}
        onCheckedChange={(checked) => api.toggle(fieldId, !checked, prefill)}
        aria-label={`${label} — ${t('fieldSource.useOrgData')}`}
      />
    </div>
  );
}

function FieldRow({
  field,
  line,
  firstOccurrenceByFieldId,
  profileGaps,
  knownValues,
  typeLabel,
  onManualChange,
  hideTitle = false,
}: FieldRowProps) {
  const t = useTranslations('Accounting.templates.builder');
  const inputId = useId();
  const overrideApi = useContext(OrgOverrideContext);
  const title = getFieldTitle(field, t);

  if (field.value.kind === 'bound') {
    const boundOverrideGroup = orgOverrideGroupFor(field.id);
    const isGap = profileGaps.has(field.value.source);
    const known = knownValues[field.value.source];
    const origin = FIELD_ORIGIN[field.value.source];
    const hasValue = !!known && !isGap;
    const placeholderExample = placeholderExampleFor(
      field.value.source,
      title,
      t,
    );

    const body = hasValue ? (
      <div className="space-y-0.5">
        <p className="text-base text-foreground">{known}</p>
        {origin && !boundOverrideGroup && (
          <p className="text-xs text-muted-foreground">
            {t(sourceLabelKey(origin))}
          </p>
        )}
      </div>
    ) : isGap ? (
      <div className="space-y-0.5">
        <p className="text-base italic text-muted-foreground">
          {placeholderExample}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('fieldList.profileWarningBefore')}{' '}
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity"
          >
            {t('fieldList.profileWarningAction')}
          </button>{' '}
          {t('fieldList.profileWarningAfter')}
        </p>
      </div>
    ) : (
      <div className="space-y-0.5">
        <p className="text-base italic text-muted-foreground">
          {placeholderExample}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(sourceLabelKey(origin))}
        </p>
      </div>
    );

    if (hideTitle) return <div className="py-1">{body}</div>;

    return (
      <InfoPanel
        variant="outline"
        title={title}
        headerRight={
          boundOverrideGroup && (
            <OrgOverrideSwitch
              fieldId={field.id}
              usingOrgData
              prefill={
                boundOverrideGroup.split
                  ? joinAddressValue(
                      knownValues[boundOverrideGroup.source] ?? '',
                      knownValues[boundOverrideGroup.split.townSource] ?? '',
                    )
                  : (known ?? '')
              }
              label={title}
            />
          )
        }
      >
        {body}
      </InfoPanel>
    );
  }

  const placeholder = t(
    `manualFieldPlaceholders.${field.id}` as Parameters<typeof t>[0],
    { pauschale: typeLabel } as Parameters<typeof t>[1],
  );
  const isDuplicate = firstOccurrenceByFieldId.get(field.id) !== line.id;

  if (isDuplicate) {
    const value = field.value.value.trim();
    const body = (
      <p className="text-sm text-muted-foreground">
        {value || <span className="italic">{t('blockEditor.notSetYet')}</span>}
        {' — '}
        {t('blockEditor.sameAsAbove')}
      </p>
    );
    if (hideTitle) return <div className="py-1">{body}</div>;
    return (
      <InfoPanel variant="outline" title={title}>
        {body}
      </InfoPanel>
    );
  }

  const splitGroup = orgOverrideGroupFor(field.id)?.split;
  const controlValue =
    (splitGroup ? overrideApi?.joinedValue(field.id) : undefined) ??
    field.value.value;

  const control =
    field.control === 'textarea' ? (
      <Textarea
        id={inputId}
        value={controlValue}
        onChange={(e) => onManualChange(field.id, e.target.value)}
        placeholder={placeholder}
        aria-label={title}
        rows={4}
      />
    ) : field.control === 'period' ? (
      <TemplateBuilderPeriodPicker
        value={field.value.value}
        placeholder={placeholder}
        onChange={(value) => onManualChange(field.id, value)}
      />
    ) : (
      <Input
        id={inputId}
        type={field.control === 'number' ? 'number' : 'text'}
        inputMode={field.control === 'number' ? 'numeric' : undefined}
        value={controlValue}
        onChange={(e) => onManualChange(field.id, e.target.value)}
        placeholder={placeholder}
        aria-label={title}
      />
    );

  if (hideTitle) return <div className="py-1">{control}</div>;

  const manualOverrideGroup = orgOverrideGroupFor(field.id);

  return (
    <InfoPanel
      variant="outline"
      title={title}
      headerRight={
        manualOverrideGroup && (
          <OrgOverrideSwitch
            fieldId={field.id}
            usingOrgData={false}
            prefill={knownValues[manualOverrideGroup.source] ?? ''}
            // switching back off discards the manual text; prefill is unused there
            label={title}
          />
        )
      }
    >
      {control}
    </InfoPanel>
  );
}

interface LineEditorProps {
  line: TemplateLine;
  firstOccurrenceByFieldId: Map<string, string>;
  profileGaps: Set<DataSourceKey>;
  knownValues: Partial<Record<DataSourceKey, string>>;
  typeLabel: string;
  onToggle: (lineId: string, enabled: boolean) => void;
  onFieldChange: (fieldId: string, value: string) => void;
}

function LineEditor({
  line,
  firstOccurrenceByFieldId,
  profileGaps,
  knownValues,
  typeLabel,
  onToggle,
  onFieldChange,
}: LineEditorProps) {
  const t = useTranslations('Accounting.templates.builder');

  if (line.optional) {
    const [soleField] = line.fields;
    const title = soleField ? getFieldTitle(soleField, t) : line.id;
    const isGap =
      soleField?.value.kind === 'bound' &&
      profileGaps.has(soleField.value.source);

    return (
      <InfoPanel
        variant="outline"
        title={title}
        inactive={!line.enabled}
        badge={isGap && <ProfileGapBadge t={t} />}
        headerRight={
          <Switch
            checked={line.enabled}
            onCheckedChange={(checked) => onToggle(line.id, checked)}
            aria-label={title}
          />
        }
      >
        {line.enabled && line.fields.length > 0 && (
          <div className="flex flex-col gap-3">
            {line.fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                line={line}
                firstOccurrenceByFieldId={firstOccurrenceByFieldId}
                profileGaps={profileGaps}
                knownValues={knownValues}
                typeLabel={typeLabel}
                onManualChange={onFieldChange}
                hideTitle
              />
            ))}
          </div>
        )}
      </InfoPanel>
    );
  }

  if (line.fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {line.fields.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          line={line}
          firstOccurrenceByFieldId={firstOccurrenceByFieldId}
          profileGaps={profileGaps}
          knownValues={knownValues}
          typeLabel={typeLabel}
          onManualChange={onFieldChange}
        />
      ))}
    </div>
  );
}

const TABLE_FIRST_COLUMN_SOURCES: TableFirstColumnSource[] = [
  'agreement_task_description',
  'custom',
];

/** The Stundennachweis table's one configurable choice — everything else about its shape is fixed. */
function TableFirstColumnSourceCard({
  block,
  onSourceChange,
  onCustomLabelChange,
}: {
  block: TemplateTableBlock;
  onSourceChange: (source: TableFirstColumnSource) => void;
  onCustomLabelChange: (value: string) => void;
}) {
  const t = useTranslations('Accounting.templates.builder');
  const idBase = useId();

  return (
    <InfoPanel
      variant="outline"
      title={t('blockEditor.firstColumnSourceLabel')}
    >
      <RadioGroup
        value={block.firstColumnSource}
        onValueChange={(value) =>
          onSourceChange(value as TableFirstColumnSource)
        }
        className="gap-3"
      >
        {TABLE_FIRST_COLUMN_SOURCES.map((source) => (
          <div key={source} className="flex items-start gap-2">
            <RadioGroupItem
              value={source}
              id={`${idBase}-${source}`}
              className="mt-0.5"
            />
            <Label htmlFor={`${idBase}-${source}`} className="font-normal">
              <div className="flex flex-col items-start gap-0.5 text-left">
                <span className="text-base font-medium text-foreground">
                  {t(
                    `blockEditor.firstColumnSourceOptions.${source}.label` as Parameters<
                      typeof t
                    >[0],
                  )}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t(
                    `blockEditor.firstColumnSourceOptions.${source}.hint` as Parameters<
                      typeof t
                    >[0],
                  )}
                </span>
              </div>
            </Label>
          </div>
        ))}
      </RadioGroup>
      {block.firstColumnSource === 'custom' && (
        <Input
          className="mt-3"
          value={block.firstColumnCustomLabel}
          onChange={(e) => onCustomLabelChange(e.target.value)}
          placeholder={t('blockEditor.firstColumnPlaceholders.custom')}
          aria-label={t('blockEditor.firstColumnSourceOptions.custom.label')}
        />
      )}
    </InfoPanel>
  );
}

interface BlockEditorRowProps {
  block: TemplateBlock;
  firstOccurrenceByFieldId: Map<string, string>;
  profileGaps: Set<DataSourceKey>;
  knownValues: Partial<Record<DataSourceKey, string>>;
  typeLabel: string;
  onLineToggle: (blockId: string, lineId: string, enabled: boolean) => void;
  onFieldChange: (fieldId: string, value: string) => void;
  onTableFirstColumnSourceChange: (
    blockId: string,
    source: TableFirstColumnSource,
  ) => void;
  onTableFirstColumnCustomLabelChange: (blockId: string, value: string) => void;
}

/**
 * A section headline (never a card itself) followed by one card per line — every block
 * reaching this component is locked/mandatory (the one switchable block, "Sonstiges", is
 * rendered by `ExtraClausesCard` instead, with its switch on the field card, not the headline).
 */
function BlockEditorRow({
  block,
  firstOccurrenceByFieldId,
  profileGaps,
  knownValues,
  typeLabel,
  onLineToggle,
  onFieldChange,
  onTableFirstColumnSourceChange,
  onTableFirstColumnCustomLabelChange,
}: BlockEditorRowProps) {
  const t = useTranslations('Accounting.templates.builder');
  const headingKey = blockHeadingKey(block);
  const heading = headingKey
    ? t(headingKey as Parameters<typeof t>[0])
    : block.title;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={SECTION_TITLE_CLASSNAME}>{heading}</span>
        {block.locked && (
          <Tooltip>
            <TooltipTrigger asChild>
              <LockIcon
                size={14}
                className="text-muted-foreground"
                aria-hidden="true"
              />
            </TooltipTrigger>
            <TooltipContent>{t('blockEditor.lockedHint')}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {block.kind === 'table' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {t('blockEditor.tableFixedHint')}
          </p>
          <TableFirstColumnSourceCard
            block={block}
            onSourceChange={(source) =>
              onTableFirstColumnSourceChange(block.id, source)
            }
            onCustomLabelChange={(value) =>
              onTableFirstColumnCustomLabelChange(block.id, value)
            }
          />
        </div>
      ) : block.kind === 'note' ? (
        <p className="text-sm text-muted-foreground">
          {t('blockEditor.alreadyReceivedHint')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {block.lines.map((line) => (
            <LineEditor
              key={line.id}
              line={line}
              firstOccurrenceByFieldId={firstOccurrenceByFieldId}
              profileGaps={profileGaps}
              knownValues={knownValues}
              typeLabel={typeLabel}
              onToggle={(lineId, enabled) =>
                onLineToggle(block.id, lineId, enabled)
              }
              onFieldChange={onFieldChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The contract's one switchable block ("Sonstiges" / Extra clauses) has exactly one line, one
 * field (the freeform textarea) — so instead of a headline that's secretly a card with the
 * on/off switch (the bug this replaces), the headline stays plain text and the single field
 * card itself carries the switch, matching every other optional-content card in this editor.
 */
function ExtraClausesCard({
  block,
  firstOccurrenceByFieldId,
  profileGaps,
  knownValues,
  typeLabel,
  onBlockToggle,
  onFieldChange,
}: {
  block: TemplateTextBlock;
  firstOccurrenceByFieldId: Map<string, string>;
  profileGaps: Set<DataSourceKey>;
  knownValues: Partial<Record<DataSourceKey, string>>;
  typeLabel: string;
  onBlockToggle: (blockId: string, enabled: boolean) => void;
  onFieldChange: (fieldId: string, value: string) => void;
}) {
  const t = useTranslations('Accounting.templates.builder');
  const [line] = block.lines;
  const [field] = line?.fields ?? [];
  if (!line || !field) return null;
  const title = getFieldTitle(field, t);

  return (
    <div className="flex flex-col gap-3">
      <span className={SECTION_TITLE_CLASSNAME}>{t('editorGroups.extra')}</span>
      <InfoPanel
        variant="outline"
        title={title}
        inactive={!block.enabled}
        headerRight={
          <Switch
            checked={block.enabled}
            onCheckedChange={(checked) => onBlockToggle(block.id, checked)}
            aria-label={title}
          />
        }
      >
        {block.enabled && (
          <FieldRow
            field={field}
            line={line}
            firstOccurrenceByFieldId={firstOccurrenceByFieldId}
            profileGaps={profileGaps}
            knownValues={knownValues}
            typeLabel={typeLabel}
            onManualChange={onFieldChange}
            hideTitle
          />
        )}
      </InfoPanel>
    </div>
  );
}

/**
 * The contract's hours-per-{unit} line has two manual fields (unit, amount) that belong in
 * one card, not two — the unit is a Tabs choice above the number input, never a separate
 * field row of its own.
 */
function HoursFieldCard({
  unitField,
  amountField,
  onFieldChange,
}: {
  unitField: TemplateField;
  amountField: TemplateField;
  onFieldChange: (fieldId: string, value: string) => void;
}) {
  const t = useTranslations('Accounting.templates.builder');
  const unitValue =
    unitField.value.kind === 'manual-template'
      ? unitField.value.value
      : 'Monat';
  const amountValue =
    amountField.value.kind === 'manual-template' ? amountField.value.value : '';
  const title = t('manualFieldLabels.hours-amount');
  const amountPlaceholder = t(
    unitValue === 'Woche'
      ? 'manualFieldPlaceholders.hours-amount-week'
      : 'manualFieldPlaceholders.hours-amount-month',
  );

  return (
    <InfoPanel variant="outline" title={title}>
      <div className="flex flex-col gap-2">
        <Tabs
          value={unitValue}
          onValueChange={(v) => onFieldChange(unitField.id, v)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="Monat" className="flex-1">
              {t('hoursUnit.month')}
            </TabsTrigger>
            <TabsTrigger value="Woche" className="flex-1">
              {t('hoursUnit.week')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          type="number"
          inputMode="numeric"
          value={amountValue}
          onChange={(e) => onFieldChange(amountField.id, e.target.value)}
          placeholder={amountPlaceholder}
          aria-label={title}
        />
      </div>
    </InfoPanel>
  );
}

interface ContractGroupSectionProps {
  title: string;
  entries: EditorFieldEntry[];
  firstOccurrenceByFieldId: Map<string, string>;
  profileGaps: Set<DataSourceKey>;
  knownValues: Partial<Record<DataSourceKey, string>>;
  typeLabel: string;
  onLineToggle: (blockId: string, lineId: string, enabled: boolean) => void;
  onFieldChange: (fieldId: string, value: string) => void;
  /** Trailing card that doesn't fit the generic field/line entry shape (e.g. the paired hours-unit/hours-amount card). */
  extra?: ReactNode;
}

function ContractGroupSection({
  title,
  entries,
  firstOccurrenceByFieldId,
  profileGaps,
  knownValues,
  typeLabel,
  onLineToggle,
  onFieldChange,
  extra,
}: ContractGroupSectionProps) {
  if (entries.length === 0 && !extra) return null;

  return (
    <div className="flex flex-col gap-3">
      <span className={SECTION_TITLE_CLASSNAME}>{title}</span>
      <div className="flex flex-col gap-3">
        {entries.map(({ field, line, blockId }) =>
          line.optional ? (
            <LineEditor
              key={line.id}
              line={line}
              firstOccurrenceByFieldId={firstOccurrenceByFieldId}
              profileGaps={profileGaps}
              knownValues={knownValues}
              typeLabel={typeLabel}
              onToggle={(lineId, enabled) =>
                onLineToggle(blockId, lineId, enabled)
              }
              onFieldChange={onFieldChange}
            />
          ) : (
            <FieldRow
              key={field.id}
              field={field}
              line={line}
              firstOccurrenceByFieldId={firstOccurrenceByFieldId}
              profileGaps={profileGaps}
              knownValues={knownValues}
              typeLabel={typeLabel}
              onManualChange={onFieldChange}
            />
          ),
        )}
        {extra}
      </div>
    </div>
  );
}

interface TemplateBuilderBlockEditorProps {
  document: TemplateDocument;
  kind: DocumentKind;
  profileGaps: Set<DataSourceKey>;
  knownValues: Partial<Record<DataSourceKey, string>>;
  typeLabel: string;
  onChange: (document: TemplateDocument) => void;
}

/**
 * PROTOTYPE (VOLI-1443). Thin wrapper that supplies the org-override toggle to the
 * whole editor tree — the body below has two separate return paths, so providing
 * the context out here beats wrapping both.
 */
export function TemplateBuilderBlockEditor(
  props: TemplateBuilderBlockEditorProps,
) {
  const overrideApi: OrgOverrideApi = {
    toggle: (fieldId, overridden, prefill) => {
      props.onChange(
        setOrgFieldOverride(props.document, fieldId, overridden, prefill),
      );
    },
    // A split group is edited as one field but stored in two document slots; give
    // the card back the whole address so the textarea does not lose the town line.
    joinedValue: (fieldId) => {
      const group = orgOverrideGroupFor(fieldId);
      if (!group?.split) return undefined;
      const streetId = group.split.streetIds[0];
      const townId = group.split.townIds[0];
      if (!streetId || !townId) return undefined;
      return joinAddressValue(
        getManualFieldValue(props.document, streetId) ?? '',
        getManualFieldValue(props.document, townId) ?? '',
      );
    },
  };

  return (
    <OrgOverrideContext.Provider value={overrideApi}>
      <TemplateBuilderBlockEditorBody {...props} />
    </OrgOverrideContext.Provider>
  );
}

function TemplateBuilderBlockEditorBody({
  document: templateDoc,
  kind,
  profileGaps,
  knownValues,
  typeLabel,
  onChange,
}: TemplateBuilderBlockEditorProps) {
  const t = useTranslations('Accounting.templates.builder');
  const firstOccurrenceByFieldId = getFirstOccurrenceLineByFieldId(templateDoc);

  function handleHeaderLineToggle(lineId: string, enabled: boolean) {
    onChange({
      ...templateDoc,
      header: {
        ...templateDoc.header,
        metaLines: updateLineEnabled(
          templateDoc.header.metaLines,
          lineId,
          enabled,
        ),
      },
    });
  }

  function handleBlockToggle(blockId: string, enabled: boolean) {
    onChange({
      ...templateDoc,
      blocks: templateDoc.blocks.map((b) =>
        b.id === blockId && b.kind === 'text' ? { ...b, enabled } : b,
      ),
    });
  }

  function handleLineToggle(blockId: string, lineId: string, enabled: boolean) {
    onChange({
      ...templateDoc,
      blocks: templateDoc.blocks.map((b) =>
        b.id === blockId && b.kind === 'text'
          ? { ...b, lines: updateLineEnabled(b.lines, lineId, enabled) }
          : b,
      ),
    });
  }

  function handleFieldChange(fieldId: string, value: string) {
    // An overridable org field is quoted under a different id per position — the
    // letterhead's `header-org-name` and the parties sentence's `parties-org-name`
    // are separate fields. `updateManualFieldValue` matches on exact id, so writing
    // only the edited one would leave the header still showing the organisation's
    // own name while the contract text named someone else. Write the whole group.
    const overrideGroup = orgOverrideGroupFor(fieldId);
    if (overrideGroup?.split) {
      // One typed address, two document slots: everything before the first newline
      // is the street line, the rest is the town.
      const { street, town } = splitAddressValue(value);
      let next = templateDoc;
      for (const id of overrideGroup.split.streetIds) {
        next = updateManualFieldValue(next, id, street);
      }
      for (const id of overrideGroup.split.townIds) {
        next = updateManualFieldValue(next, id, town);
      }
      onChange(next);
      return;
    }
    if (overrideGroup) {
      let next = templateDoc;
      for (const id of overrideGroup.fieldIds) {
        next = updateManualFieldValue(next, id, value);
      }
      onChange(next);
      return;
    }
    onChange(updateManualFieldValue(templateDoc, fieldId, value));
  }

  function handleTableFirstColumnSourceChange(
    blockId: string,
    source: TableFirstColumnSource,
  ) {
    onChange({
      ...templateDoc,
      blocks: templateDoc.blocks.map((b) =>
        b.id === blockId && b.kind === 'table'
          ? { ...b, firstColumnSource: source }
          : b,
      ),
    });
  }

  function handleTableFirstColumnCustomLabelChange(
    blockId: string,
    value: string,
  ) {
    onChange({
      ...templateDoc,
      blocks: templateDoc.blocks.map((b) =>
        b.id === blockId && b.kind === 'table'
          ? { ...b, firstColumnCustomLabel: value }
          : b,
      ),
    });
  }

  const hasHeaderConfig =
    templateDoc.header.metaLines.length > 0 ||
    templateDoc.invoiceNumberFormat !== undefined;

  if (kind === 'contract') {
    const groups = collectContractEditorGroups(templateDoc);

    return (
      <div className="flex flex-col gap-6">
        <ContractGroupSection
          title={t('editorGroups.org')}
          entries={groups.org}
          firstOccurrenceByFieldId={firstOccurrenceByFieldId}
          profileGaps={profileGaps}
          knownValues={knownValues}
          typeLabel={typeLabel}
          onLineToggle={handleLineToggle}
          onFieldChange={handleFieldChange}
        />
        <ContractGroupSection
          title={t('editorGroups.volunteer')}
          entries={groups.volunteer}
          firstOccurrenceByFieldId={firstOccurrenceByFieldId}
          profileGaps={profileGaps}
          knownValues={knownValues}
          typeLabel={typeLabel}
          onLineToggle={handleLineToggle}
          onFieldChange={handleFieldChange}
        />
        <ContractGroupSection
          title={t('editorGroups.engagement')}
          entries={groups.engagement}
          firstOccurrenceByFieldId={firstOccurrenceByFieldId}
          profileGaps={profileGaps}
          knownValues={knownValues}
          typeLabel={typeLabel}
          onLineToggle={handleLineToggle}
          onFieldChange={handleFieldChange}
          extra={
            groups.hours && (
              <HoursFieldCard
                unitField={groups.hours.unitField}
                amountField={groups.hours.amountField}
                onFieldChange={handleFieldChange}
              />
            )
          }
        />
        {groups.signaturePlace && (
          <ContractGroupSection
            title={t('editorGroups.signaturePlace')}
            entries={[groups.signaturePlace]}
            firstOccurrenceByFieldId={firstOccurrenceByFieldId}
            profileGaps={profileGaps}
            knownValues={knownValues}
            typeLabel={typeLabel}
            onLineToggle={handleLineToggle}
            onFieldChange={handleFieldChange}
          />
        )}
        {groups.extraBlock && (
          <ExtraClausesCard
            block={groups.extraBlock}
            firstOccurrenceByFieldId={firstOccurrenceByFieldId}
            profileGaps={profileGaps}
            knownValues={knownValues}
            typeLabel={typeLabel}
            onBlockToggle={handleBlockToggle}
            onFieldChange={handleFieldChange}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {hasHeaderConfig && (
        <div className="flex flex-col gap-3">
          <span className={SECTION_TITLE_CLASSNAME}>
            {t('blockEditor.headerTitle')}
          </span>
          <div className="flex flex-col gap-3">
            {templateDoc.invoiceNumberFormat !== undefined && (
              <InfoPanel
                variant="outline"
                title={t('blockEditor.invoiceNumberFormatLabel')}
              >
                <Select
                  value={templateDoc.invoiceNumberFormat}
                  onValueChange={(value) =>
                    onChange({
                      ...templateDoc,
                      invoiceNumberFormat: value as InvoiceNumberFormat,
                    })
                  }
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_NUMBER_FORMATS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {t(
                          `invoiceNumberFormats.${format}` as Parameters<
                            typeof t
                          >[0],
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </InfoPanel>
            )}
            {templateDoc.header.metaLines.map((line) => (
              <LineEditor
                key={line.id}
                line={line}
                firstOccurrenceByFieldId={firstOccurrenceByFieldId}
                profileGaps={profileGaps}
                knownValues={knownValues}
                typeLabel={typeLabel}
                onToggle={handleHeaderLineToggle}
                onFieldChange={handleFieldChange}
              />
            ))}
          </div>
        </div>
      )}

      {templateDoc.blocks.map((block) => (
        <BlockEditorRow
          key={block.id}
          block={block}
          firstOccurrenceByFieldId={firstOccurrenceByFieldId}
          profileGaps={profileGaps}
          knownValues={knownValues}
          typeLabel={typeLabel}
          onLineToggle={handleLineToggle}
          onFieldChange={handleFieldChange}
          onTableFirstColumnSourceChange={handleTableFirstColumnSourceChange}
          onTableFirstColumnCustomLabelChange={
            handleTableFirstColumnCustomLabelChange
          }
        />
      ))}
    </div>
  );
}
