import { describe, expect, it } from 'bun:test';
import de from '../../../../../../messages/de.json';
import en from '../../../../../../messages/en.json';
import {
  getContractDocument,
  getInvoiceDocument,
} from '../builder-document-presets';
import {
  ALWAYS_AVAILABLE_SOURCES,
  PROFILE_REQUIRED_SOURCES,
  type TemplateDocument,
} from '../builder-types';

// The builder looks these labels up with dynamic keys cast past the type
// checker, so a missing entry only shows up as a raw key in the UI.
const ALL_SOURCES = [...ALWAYS_AVAILABLE_SOURCES, ...PROFILE_REQUIRED_SOURCES];

function manualFieldIds(doc: TemplateDocument): string[] {
  const lines = [
    doc.header.orgIdentityLine,
    ...(doc.header.metaLines ?? []),
    ...doc.blocks.flatMap((block) =>
      block.kind === 'text' ? block.lines : [],
    ),
  ];
  return lines.flatMap((line) =>
    line.fields
      .filter((field) => field.value.kind === 'manual-template')
      .map((field) => field.id),
  );
}

const MANUAL_FIELD_IDS = [
  ...new Set(
    (['ehrenamt', 'uebungsleiter'] as const).flatMap((pauschale) => [
      ...manualFieldIds(getContractDocument(pauschale)),
      ...manualFieldIds(getInvoiceDocument(pauschale)),
    ]),
  ),
];

for (const [locale, messages] of [
  ['de', de],
  ['en', en],
] as const) {
  describe(`template builder messages (${locale})`, () => {
    const builder = messages.Accounting.templates.builder;

    it('labels every data source', () => {
      const missing = ALL_SOURCES.filter(
        (key) => !(key in builder.dataSources),
      );
      expect(missing).toEqual([]);
    });

    it('labels every manual field in the presets', () => {
      const missing = MANUAL_FIELD_IDS.filter(
        (id) => !(id in builder.manualFieldLabels),
      );
      expect(missing).toEqual([]);
    });
  });
}
