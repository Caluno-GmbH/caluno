import { describe, expect, it } from 'bun:test';
import {
  getContractDocument,
  getInvoiceDocument,
} from './builder-document-presets';

describe('contract preset org name/address separators (VOLI-1325)', () => {
  const doc = getContractDocument('ehrenamt');

  it('separates the org name and address in the header with a line break', () => {
    expect(doc.header.orgIdentityLine.text).toBe('{orgName}\n{orgAddress}');
  });

  it('separates the org name and address in the parties line with a comma', () => {
    const partiesBlock = doc.blocks.find((b) => b.id === 'persoenliche-daten');
    const partiesLine =
      partiesBlock?.kind === 'text'
        ? partiesBlock.lines.find((l) => l.id === 'parties')
        : undefined;

    expect(partiesLine?.text).toBe('Zwischen dem {orgName}, {orgAddress}, und');
  });

  it('leaves the invoice header address-only', () => {
    expect(getInvoiceDocument('ehrenamt').header.orgIdentityLine.text).toBe(
      '{orgAddress}',
    );
  });
});
