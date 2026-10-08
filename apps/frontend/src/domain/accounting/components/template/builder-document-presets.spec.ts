import { describe, expect, it } from 'bun:test';
import {
  getContractDocument,
  getInvoiceDocument,
} from './builder-document-presets';

function contractLine(id: string) {
  const block = getContractDocument('ehrenamt').blocks.find(
    (b) => b.kind === 'text' && b.lines.some((line) => line.id === id),
  );
  return block?.kind === 'text'
    ? block.lines.find((line) => line.id === id)
    : undefined;
}

function invoiceLine(id: string) {
  const block = getInvoiceDocument('ehrenamt').blocks.find(
    (b) => b.id === 'persoenliche-daten',
  );
  return block?.kind === 'text'
    ? block.lines.find((line) => line.id === id)
    : undefined;
}

describe('document preset org identity', () => {
  it('Names the org as the first contracting party with its full address', () => {
    // VOLI-1325 asked for the name and address separated by a comma, which this
    // keeps. The postcode and town joined them under VOLI-1443: the letterhead
    // above states all three, and a street alone does not identify the body
    // signing the agreement.
    expect(contractLine('parties')?.text).toBe(
      'Zwischen dem {orgName}, {orgStreet}, {orgZip} {orgCity}',
    );
  });

  it('Carries the conjunction on the volunteer line, not the org one', () => {
    // So the optional additional-information line can sit between the two
    // parties without stranding an "und" on a line of its own.
    expect(contractLine('parties')?.text.endsWith(', und')).toBe(false);
    expect(contractLine('volunteer-name')?.text.startsWith('und ')).toBe(true);
  });

  it('Offers the additional-information line off by default', () => {
    const line = contractLine('parties-additional');

    expect(line?.optional).toBe(true);
    expect(line?.enabled).toBe(false);
    expect(line?.fields[0]?.control).toBe('textarea');
  });

  it('Reads on from the address rather than dropping to its own line', () => {
    // It belongs to the parties sentence, so it follows the town and wraps
    // only when it runs out of room.
    expect(contractLine('parties-additional')?.inline).toBe(true);
    expect(contractLine('parties')?.inline).toBeUndefined();
  });

  it('Reads the facility from its own source, not the organisation name', () => {
    // Where a volunteer serves can differ from who signs the agreement, which
    // is the whole point of the override.
    const engagement = getContractDocument('ehrenamt').blocks.find(
      (b) => b.id === 'zeitraum-taetigkeit',
    );
    const scope =
      engagement?.kind === 'text'
        ? engagement.lines.find((l) => l.id === 'engagement-scope')
        : undefined;
    const orgField = scope?.fields.find((f) => f.id === 'engagement-org-name');

    expect(orgField?.value).toEqual({
      kind: 'bound',
      source: 'org_facility_name',
    });
  });
});

describe('timesheet free text', () => {
  it('Offers an opt-in free-text block, off until a coordinator wants it', () => {
    const doc = getInvoiceDocument('ehrenamt');
    const block = doc.blocks.find((b) => b.id === 'sonstiges');

    expect(block?.kind).toBe('text');
    if (block?.kind !== 'text') throw new Error('expected a text block');
    expect(block.locked).toBe(false);
    expect(block.enabled).toBe(false);
  });

  it('Places it last, so it prints above the signatures', () => {
    const doc = getInvoiceDocument('ehrenamt');

    expect(doc.blocks[doc.blocks.length - 1]?.id).toBe('sonstiges');
    expect(doc.footer.showSignatures).toBe(true);
  });

  it('Carries one editable field, mirroring the contract', () => {
    const invoiceBlock = getInvoiceDocument('ehrenamt').blocks.find(
      (b) => b.id === 'sonstiges',
    );
    const contractBlock = getContractDocument('ehrenamt').blocks.find(
      (b) => b.id === 'sonstiges',
    );
    const fieldOf = (block: typeof invoiceBlock) =>
      block?.kind === 'text' ? block.lines[0]?.fields[0] : undefined;

    expect(fieldOf(invoiceBlock)).toEqual(fieldOf(contractBlock));
    expect(fieldOf(invoiceBlock)?.control).toBe('textarea');
  });
});

describe('timesheet table columns', () => {
  it('Heads the rate column with the same hours unit the cells below use', () => {
    const doc = getInvoiceDocument('ehrenamt');
    const table = doc.blocks.find((b) => b.id === 'stundennachweis');

    expect(table?.kind).toBe('table');
    if (table?.kind !== 'table') throw new Error('expected a table block');
    expect(table.columns).toEqual([
      'Tätigkeit',
      'Beginn',
      'Ende',
      'Stunden gesamt',
      '€/h',
      'Betrag',
    ]);
  });
});

describe('optional BIC (VOLI-1544)', () => {
  it('Offers the agreement BIC line as an opt-in, off by default', () => {
    // SEPA payouts do not need a BIC; only non-EU accounts do. Like the date
    // of birth, the coordinator enables the line when their volunteers need it.
    const line = contractLine('payout-bic');

    expect(line?.optional).toBe(true);
    expect(line?.enabled).toBe(false);
  });

  it('Binds the agreement BIC line to the volunteer bic profile field', () => {
    expect(contractLine('payout-bic')?.fields[0]?.value).toEqual({
      kind: 'bound',
      source: 'volunteer_bic',
    });
  });

  it('Adds an opt-in BIC line to the timesheet, off by default', () => {
    const line = invoiceLine('volunteer-bic');

    expect(line?.optional).toBe(true);
    expect(line?.enabled).toBe(false);
    expect(line?.fields[0]?.value).toEqual({
      kind: 'bound',
      source: 'volunteer_bic',
    });
  });

  it('Sits the timesheet BIC directly after the IBAN line', () => {
    const block = getInvoiceDocument('ehrenamt').blocks.find(
      (b) => b.id === 'persoenliche-daten',
    );
    const ids =
      block?.kind === 'text' ? block.lines.map((line) => line.id) : [];

    expect(ids.indexOf('volunteer-bic')).toBe(
      ids.indexOf('volunteer-iban') + 1,
    );
  });

  it('Applies to both pauschalen', () => {
    for (const pauschale of ['ehrenamt', 'uebungsleiter'] as const) {
      const contractBicBlock = getContractDocument(pauschale).blocks.find(
        (b) => b.kind === 'text' && b.lines.some((l) => l.id === 'payout-bic'),
      );
      const bicLine =
        contractBicBlock?.kind === 'text'
          ? contractBicBlock.lines.find((l) => l.id === 'payout-bic')
          : undefined;
      const invoiceBlock = getInvoiceDocument(pauschale).blocks.find(
        (b) => b.id === 'persoenliche-daten',
      );
      const invoiceBic =
        invoiceBlock?.kind === 'text'
          ? invoiceBlock.lines.find((l) => l.id === 'volunteer-bic')
          : undefined;

      expect(bicLine?.optional).toBe(true);
      expect(bicLine?.enabled).toBe(false);
      expect(invoiceBic?.optional).toBe(true);
      expect(invoiceBic?.enabled).toBe(false);
    }
  });
});
