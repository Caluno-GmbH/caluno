import { describe, expect, it } from 'bun:test';
import { getInvoiceDocument } from './builder-document-presets';
import { blockHeadingKey } from './builder-headings';
import type { TemplateBlock } from './builder-types';

describe('blockHeadingKey', () => {
  it('covers every invoice block the editor renders as a section heading', () => {
    const doc = getInvoiceDocument('ehrenamt');
    // The one switchable block is rendered by ExtraClausesCard, which carries
    // its own translated heading instead of going through this map.
    const throughBlockEditorRow = doc.blocks.filter(
      (block) => block.id !== 'sonstiges',
    );
    expect(throughBlockEditorRow.length).toBe(doc.blocks.length - 1);
    for (const block of throughBlockEditorRow) {
      expect(blockHeadingKey(block)).toBeDefined();
    }
  });

  it('falls back to undefined for a block id with no editor heading', () => {
    const block: TemplateBlock = {
      kind: 'text',
      id: 'unmapped-block',
      title: 'Irgendeine Überschrift',
      locked: true,
      enabled: true,
      lines: [],
    };
    expect(blockHeadingKey(block)).toBeUndefined();
  });
});
