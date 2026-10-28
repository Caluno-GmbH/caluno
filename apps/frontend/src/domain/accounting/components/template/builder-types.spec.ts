import { describe, expect, it } from 'bun:test';
import {
  getContractDocument,
  getInvoiceDocument,
} from './builder-document-presets';
import {
  countOverLimitManualFields,
  invoiceNumberNeedsKostenstelle,
  KOSTENSTELLE_LINE_ID,
  updateManualFieldValue,
  withKostenstelleForNumberFormat,
} from './builder-types';

function kostenstelleLine(doc: ReturnType<typeof getInvoiceDocument>) {
  return doc.header.metaLines.find((line) => line.id === KOSTENSTELLE_LINE_ID);
}

describe('invoiceNumberNeedsKostenstelle', () => {
  it('Is true only for the formats that put a cost centre in the number', () => {
    expect(invoiceNumberNeedsKostenstelle('date-kostenstelle-number')).toBe(
      true,
    );
    expect(
      invoiceNumberNeedsKostenstelle('kostenstelle-month-year-number'),
    ).toBe(true);
    expect(invoiceNumberNeedsKostenstelle('date-number')).toBe(false);
    expect(invoiceNumberNeedsKostenstelle('compact-date-number')).toBe(false);
    expect(invoiceNumberNeedsKostenstelle(undefined)).toBe(false);
  });
});

describe('withKostenstelleForNumberFormat', () => {
  it('Leaves the opt-in line off while the number format does not need one', () => {
    const doc = withKostenstelleForNumberFormat(getInvoiceDocument('ehrenamt'));

    expect(doc.invoiceNumberFormat).toBe('date-number');
    expect(kostenstelleLine(doc)?.enabled).toBe(false);
  });

  it('Switches the line on when the chosen format states the cost centre', () => {
    const doc = withKostenstelleForNumberFormat({
      ...getInvoiceDocument('ehrenamt'),
      invoiceNumberFormat: 'date-kostenstelle-number',
    });

    expect(kostenstelleLine(doc)?.enabled).toBe(true);
    expect(kostenstelleLine(doc)?.optional).toBe(true);
  });

  it('Keeps a coordinator-enabled line on after switching back to a plain format', () => {
    const enabled = withKostenstelleForNumberFormat({
      ...getInvoiceDocument('ehrenamt'),
      invoiceNumberFormat: 'kostenstelle-month-year-number',
    });
    const backToPlain = withKostenstelleForNumberFormat({
      ...enabled,
      invoiceNumberFormat: 'date-number',
    });

    expect(kostenstelleLine(backToPlain)?.enabled).toBe(true);
  });
});

describe('invoice header meta lines', () => {
  it('Labels the document number and date rather than printing them bare', () => {
    const doc = getInvoiceDocument('uebungsleiter');
    const byId = new Map(doc.header.metaLines.map((line) => [line.id, line]));

    expect(byId.get('meta-invoice-number')?.text).toBe(
      'Rechnungsnummer: {documentNumber}',
    );
    expect(byId.get('meta-date')?.text).toBe('Datum: {date}');
  });
});

describe('countOverLimitManualFields', () => {
  it('counts a task description over 300 characters', () => {
    const doc = updateManualFieldValue(
      getContractDocument('ehrenamt'),
      'tasks',
      'x'.repeat(301),
    );

    expect(countOverLimitManualFields(doc)).toBe(1);
  });

  it('does not count a value at the limit', () => {
    const doc = updateManualFieldValue(
      getContractDocument('ehrenamt'),
      'tasks',
      'x'.repeat(300),
    );

    expect(countOverLimitManualFields(doc)).toBe(0);
  });

  it('ignores fields on disabled lines', () => {
    const base = getContractDocument('ehrenamt');
    const disabled = {
      ...base,
      blocks: base.blocks.map((b) =>
        b.kind === 'text'
          ? {
              ...b,
              lines: b.lines.map((l) =>
                l.id === 'engagement-tasks' ? { ...l, enabled: false } : l,
              ),
            }
          : b,
      ),
    };

    const doc = updateManualFieldValue(disabled, 'tasks', 'x'.repeat(301));

    expect(countOverLimitManualFields(doc)).toBe(0);
  });

  it('leaves freeform text unlimited', () => {
    const doc = updateManualFieldValue(
      getContractDocument('ehrenamt'),
      'freeform-text',
      'x'.repeat(5000),
    );

    expect(countOverLimitManualFields(doc)).toBe(0);
  });
});
