import { describe, expect, it } from 'bun:test';
import { formatInvoiceNumber } from './invoice-number';

const JULY_FIRST = new Date('2026-07-01T09:00:00.000Z');

describe('formatInvoiceNumber', () => {
  it('Writes the date and a three-digit sequence by default', () => {
    expect(
      formatInvoiceNumber({
        invoiceFormat: 'date-number',
        periodStart: JULY_FIRST,
        kostenstelle: undefined,
        sequence: 7,
      }),
    ).toBe('20260701-007');
  });

  it('Keeps counting past three digits rather than truncating', () => {
    expect(
      formatInvoiceNumber({
        invoiceFormat: 'date-number',
        periodStart: JULY_FIRST,
        kostenstelle: undefined,
        sequence: 1234,
      }),
    ).toBe('20260701-1234');
  });

  it('Places the cost centre where the chosen format states it', () => {
    expect(
      formatInvoiceNumber({
        invoiceFormat: 'date-kostenstelle-number',
        periodStart: JULY_FIRST,
        kostenstelle: 'KST-42',
        sequence: 1,
      }),
    ).toBe('20260701-KST-42-001');

    expect(
      formatInvoiceNumber({
        invoiceFormat: 'kostenstelle-month-year-number',
        periodStart: JULY_FIRST,
        kostenstelle: 'KST-42',
        sequence: 1,
      }),
    ).toBe('KST-42-07.2026-001');
  });

  it('Shows a dash where a cost centre was never entered', () => {
    expect(
      formatInvoiceNumber({
        invoiceFormat: 'date-kostenstelle-number',
        periodStart: JULY_FIRST,
        kostenstelle: '   ',
        sequence: 1,
      }),
    ).toBe('20260701-—-001');
  });

  it('Shortens the year for the compact format', () => {
    expect(
      formatInvoiceNumber({
        invoiceFormat: 'compact-date-number',
        periodStart: JULY_FIRST,
        kostenstelle: undefined,
        sequence: 3,
      }),
    ).toBe('260701003');
  });

  it('Reads the date in the app time zone, not UTC', () => {
    // 31 July 23:30 UTC is already 1 August in Berlin, which is the day the
    // organisation would write on the document.
    expect(
      formatInvoiceNumber({
        invoiceFormat: 'date-number',
        periodStart: new Date('2026-07-31T23:30:00.000Z'),
        kostenstelle: undefined,
        sequence: 1,
      }),
    ).toBe('20260801-001');
  });

  it('Falls back to the date format when the template names none', () => {
    expect(
      formatInvoiceNumber({
        invoiceFormat: null,
        periodStart: JULY_FIRST,
        kostenstelle: undefined,
        sequence: 1,
      }),
    ).toBe('20260701-001');
  });
});
