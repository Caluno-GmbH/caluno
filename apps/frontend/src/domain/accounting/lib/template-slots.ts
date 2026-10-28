import type { InvoiceNumberFormat, RawReimbursementType } from '@repo/data';
import type { TemplateSlotRef } from '@repo/data/react';
import type { PauschalenType } from '../components/doc-type-header';
import {
  apiDocumentKindFor,
  reimbursementTypeKeyFor,
} from './reimbursement-type-mapping';

export type TemplateProvenance =
  | { kind: 'own' }
  | { kind: 'inherited'; unitName: string }
  | { kind: 'orgWide' };

/**
 * Where a slot's resolved template comes from, relative to the unit viewing it.
 * Resolution itself happens on the backend (own unit, ancestors, org-wide); this
 * only labels the answer. `organizationUnit: null` means the org-wide default.
 */
export function templateProvenance(
  template: { organizationUnit?: { id: string; name: string } | null },
  organizationUnitId: string,
): TemplateProvenance {
  const owner = template.organizationUnit;
  if (!owner) return { kind: 'orgWide' };
  if (owner.id === organizationUnitId) return { kind: 'own' };
  return { kind: 'inherited', unitName: owner.name };
}

const INVOICE_NUMBER_FORMATS: readonly InvoiceNumberFormat[] = [
  'date-number',
  'date-kostenstelle-number',
  'compact-date-number',
  'kostenstelle-month-year-number',
];

/** Narrows the API's free-form `invoiceNumberFormat` string to the known formats. */
export function asInvoiceNumberFormat(
  value: string | null | undefined,
): InvoiceNumberFormat | undefined {
  return INVOICE_NUMBER_FORMATS.find((format) => format === value);
}

/** The reimbursement type behind a Pauschale, once the types have loaded. */
export function findReimbursementType<T extends { key: string }>(
  pauschale: PauschalenType,
  types: readonly T[] | undefined,
): T | undefined {
  const key = reimbursementTypeKeyFor(pauschale);
  return types?.find((type) => type.key === key);
}

/**
 * The backend slot a Pauschale + document kind addresses. The type id is
 * undefined until the reimbursement types have loaded.
 */
export function slotRefFor(
  pauschale: PauschalenType,
  kind: 'contract' | 'invoice',
  types: readonly Pick<RawReimbursementType, 'id' | 'key'>[] | undefined,
): TemplateSlotRef {
  return {
    kind: apiDocumentKindFor(kind),
    reimbursementTypeId: findReimbursementType(pauschale, types)?.id,
  };
}
