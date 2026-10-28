import type { InvoiceNumberFormat } from '@repo/data';

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
