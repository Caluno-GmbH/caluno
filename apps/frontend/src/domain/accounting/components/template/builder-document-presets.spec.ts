import { describe, expect, it } from 'bun:test';
import { getContractDocument } from './builder-document-presets';

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
