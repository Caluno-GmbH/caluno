import { describe, expect, it } from 'bun:test';
import { getInvoiceDocument } from './builder-document-presets';
import {
  invoiceNumberNeedsKostenstelle,
  KOSTENSTELLE_LINE_ID,
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
