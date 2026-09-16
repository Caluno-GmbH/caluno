import { describe, expect, it } from 'bun:test';
import de from '../../../../../messages/de.json';
import en from '../../../../../messages/en.json';
import { getInvoiceDocument } from './builder-document-presets';
import { blockHeadingKey } from './builder-headings';
import type { TemplateBlock } from './builder-types';

describe('blockHeadingKey', () => {
  it('covers every invoice block the editor renders as a section heading', () => {
    const doc = getInvoiceDocument('ehrenamt');
    for (const block of doc.blocks) {
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

describe('document-intrinsic legal terms', () => {
  it('keeps the Stundennachweis heading identical in both catalogs (deliberately German)', () => {
    const builder = (catalog: typeof en) =>
      catalog.Accounting.templates.builder.blockHeadings.stundennachweis;
    expect(builder(en)).toBe('Stundennachweis');
    expect(builder(de)).toBe('Stundennachweis');
  });

  it('localizes the interface headings', () => {
    const builder = (catalog: typeof en) =>
      catalog.Accounting.templates.builder;
    expect(builder(en).blockHeadings.persoenlicheDaten).not.toBe(
      builder(de).blockHeadings.persoenlicheDaten,
    );
    expect(builder(en).blockHeadings.jahresdeckelHinweis).not.toBe(
      builder(de).blockHeadings.jahresdeckelHinweis,
    );
  });

  it('keeps the invoice legal field labels German in both catalogs', () => {
    const labels = (catalog: typeof en) =>
      catalog.Accounting.templates.builder.manualFieldLabels;
    for (const key of [
      'kostenstelle',
      'kostentraeger',
      'rechtstraeger',
    ] as const) {
      expect(labels(en)[key]).toBe(labels(de)[key]);
    }
  });
});
