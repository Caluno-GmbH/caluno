import { describe, expect, it } from 'bun:test';
import {
  getContractDocument,
  getInvoiceDocument,
} from './builder-document-presets';

describe('document preset org identity', () => {
  it('Renders the org as the first contracting party with its address', () => {
    const doc = getContractDocument('ehrenamt');
    const partiesBlock = doc.blocks.find((b) => b.id === 'persoenliche-daten');
    const partiesLine =
      partiesBlock?.kind === 'text'
        ? partiesBlock.lines.find((l) => l.id === 'parties')
        : undefined;

    expect(partiesLine?.text).toBe('Zwischen dem {orgName}, {orgAddress}, und');
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
