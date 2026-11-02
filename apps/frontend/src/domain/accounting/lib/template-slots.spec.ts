import { describe, expect, it } from 'bun:test';
import { DocumentKind, ReimbursementTypeKey } from '@repo/data';
import {
  asInvoiceNumberFormat,
  findReimbursementType,
  isUnchangedTemplateCopy,
  slotRefFor,
  templateProvenance,
} from './template-slots';

describe('templateProvenance', () => {
  it('is own when the template belongs to the viewing unit', () => {
    expect(
      templateProvenance(
        { organizationUnit: { id: 'unit-1', name: 'Unit 1' } },
        'unit-1',
      ),
    ).toEqual({ kind: 'own' });
  });

  it('is inherited, with the source unit name, when an ancestor owns it', () => {
    expect(
      templateProvenance(
        { organizationUnit: { id: 'root', name: 'Verein' } },
        'unit-1',
      ),
    ).toEqual({ kind: 'inherited', unitName: 'Verein' });
  });

  it('is org-wide when no unit owns the template', () => {
    expect(templateProvenance({ organizationUnit: null }, 'unit-1')).toEqual({
      kind: 'orgWide',
    });
    expect(templateProvenance({}, 'unit-1')).toEqual({ kind: 'orgWide' });
  });
});

describe('asInvoiceNumberFormat', () => {
  it('passes through known formats', () => {
    expect(asInvoiceNumberFormat('date-number')).toBe('date-number');
    expect(asInvoiceNumberFormat('kostenstelle-month-year-number')).toBe(
      'kostenstelle-month-year-number',
    );
  });

  it('returns undefined for unknown or missing values', () => {
    expect(asInvoiceNumberFormat('nope')).toBeUndefined();
    expect(asInvoiceNumberFormat(null)).toBeUndefined();
    expect(asInvoiceNumberFormat(undefined)).toBeUndefined();
  });
});

const TYPES = [
  { id: 'type-ehrenamt', key: ReimbursementTypeKey.Ehrenamt },
  { id: 'type-ul', key: ReimbursementTypeKey.Uebungsleiter },
];

describe('findReimbursementType', () => {
  it('finds the type behind a Pauschale', () => {
    expect(findReimbursementType('uebungsleiter', TYPES)).toBe(TYPES[1]);
  });

  it('is undefined while the types are loading', () => {
    expect(findReimbursementType('ehrenamt', undefined)).toBeUndefined();
  });
});

describe('slotRefFor', () => {
  it('maps the Pauschale and kind to the API slot', () => {
    expect(slotRefFor('ehrenamt', 'contract', TYPES)).toEqual({
      kind: DocumentKind.Contract,
      reimbursementTypeId: 'type-ehrenamt',
    });
    expect(slotRefFor('uebungsleiter', 'invoice', TYPES)).toEqual({
      kind: DocumentKind.Invoice,
      reimbursementTypeId: 'type-ul',
    });
  });

  it('leaves the type id undefined until the types have loaded', () => {
    expect(slotRefFor('ehrenamt', 'invoice', undefined)).toEqual({
      kind: DocumentKind.Invoice,
      reimbursementTypeId: undefined,
    });
  });
});

describe('isUnchangedTemplateCopy', () => {
  const doc = { blocks: ['a', 'b'], title: 'T' };
  const baseline = JSON.stringify(doc);

  it('never blocks saving an own template', () => {
    expect(isUnchangedTemplateCopy('own', doc, baseline)).toBe(false);
  });

  it('blocks an unchanged inherited template', () => {
    expect(isUnchangedTemplateCopy('inherited', doc, baseline)).toBe(true);
  });

  it('does not block an inherited template with one edit', () => {
    expect(
      isUnchangedTemplateCopy('inherited', { ...doc, title: 'T2' }, baseline),
    ).toBe(false);
  });

  it('blocks again when an edit is reverted', () => {
    const edited = { ...doc, title: 'T2' };
    expect(isUnchangedTemplateCopy('inherited', edited, baseline)).toBe(false);
    expect(
      isUnchangedTemplateCopy('inherited', { ...edited, title: 'T' }, baseline),
    ).toBe(true);
  });

  it('blocks an unchanged org-wide template', () => {
    expect(isUnchangedTemplateCopy('orgWide', doc, baseline)).toBe(true);
  });

  it('does not block a slot with no provenance', () => {
    expect(isUnchangedTemplateCopy(null, doc, baseline)).toBe(false);
    expect(isUnchangedTemplateCopy(undefined, doc, baseline)).toBe(false);
  });

  it('does not block before the document is loaded', () => {
    expect(isUnchangedTemplateCopy('inherited', null, baseline)).toBe(false);
  });
});
