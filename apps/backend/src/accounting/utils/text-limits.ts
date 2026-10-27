import { BadRequestGraphQLError } from '../../graphql/errors/bad-request.error';
import type { DocumentFieldOverrideInput } from '../inputs/document-field-override.input';
import type {
  TemplateBodyShape,
  TemplateLineShape,
} from '../services/document-template.types';

// Duplicated from packages/data (text-limits.ts); keep in sync.
/** Character limits per manual field id; fields not listed are unlimited. */
export const MANUAL_FIELD_MAX_LENGTH: Readonly<Record<string, number>> = {
  tasks: 300,
  'freeform-text': 1000,
};

const MANUAL_FIELD_LABEL: Readonly<Record<string, string>> = {
  tasks: 'Task description',
  'freeform-text': 'Freeform text',
};

/** Own-property lookup, so ids like `constructor` never resolve to a limit. */
function limitFor(fieldId: string): number | undefined {
  return Object.hasOwn(MANUAL_FIELD_MAX_LENGTH, fieldId)
    ? MANUAL_FIELD_MAX_LENGTH[fieldId]
    : undefined;
}

function assertWithinLimit(fieldId: string, value: unknown): void {
  const max = limitFor(fieldId);
  if (max === undefined || typeof value !== 'string' || value.length <= max) {
    return;
  }
  throw new BadRequestGraphQLError(
    `${MANUAL_FIELD_LABEL[fieldId]} must be at most ${max} characters`,
  );
}

function assertLine(line: TemplateLineShape | undefined): void {
  if (!line || !Array.isArray(line.fields)) return;
  for (const field of line.fields) {
    if (field?.value?.kind === 'manual-template') {
      assertWithinLimit(field.id, field.value.value);
    }
  }
}

function assertLines(lines: TemplateLineShape[] | undefined): void {
  if (!Array.isArray(lines)) return;
  for (const line of lines) assertLine(line);
}

/**
 * Rejects a template body whose manual fields exceed their character limit.
 * Used when a template is saved; stored templates are never re-validated.
 */
export function assertManualFieldLengthsInBody(body: unknown): void {
  if (typeof body !== 'object' || body === null) return;
  const shape = body as TemplateBodyShape;
  assertLines(shape.header?.metaLines);
  assertLine(shape.header?.orgIdentityLine);
  if (Array.isArray(shape.blocks)) {
    for (const block of shape.blocks) {
      assertLines(block?.lines);
      assertLine(block?.line);
    }
  }
  assertLine(shape.footer?.closingLine);
}

/** Rejects per-document field overrides that exceed their character limit. */
export function assertFieldOverrideLengths(
  overrides: DocumentFieldOverrideInput[] | null | undefined,
): void {
  for (const override of overrides ?? []) {
    assertWithinLimit(override.fieldId, override.value);
  }
}
