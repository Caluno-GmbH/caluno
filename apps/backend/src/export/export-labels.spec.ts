import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExportCollector } from './collectors/export-collector';
import { ShiftsExportCollector } from './collectors/shifts-export.collector';
import { TimesheetsExportCollector } from './collectors/timesheets-export.collector';
import { UsersExportCollector } from './collectors/users-export.collector';

const LOCALES_PATH = join(__dirname, '../i18n/locales');

function loadLocale(locale: 'en' | 'de'): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(LOCALES_PATH, locale, 'export.json'), 'utf8'),
  );
}

function lookup(messages: unknown, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

const collectors: ExportCollector[] = [
  new TimesheetsExportCollector(
    null as never,
    null as never,
    null as never,
    null as never,
  ),
  new UsersExportCollector(null as never),
  new ShiftsExportCollector(null as never),
];

const labelKeys = collectors.flatMap((collector) => [
  ...collector.columns.map((column) => column.labelKey),
  collector.technicalIdLabelKey,
]);

describe('export CSV labels', () => {
  for (const locale of ['en', 'de'] as const) {
    it(`defines every collector label in ${locale}`, () => {
      const messages = loadLocale(locale);
      // The i18n loader namespaces a catalog by its filename, so the runtime
      // key starts with `export.`; the file itself starts at `columns`.
      const missing = labelKeys.filter(
        (key) => !lookup(messages, key.replace(/^export\./, '')),
      );
      expect(missing).toEqual([]);
    });
  }

  it('has the same label keys in both locales', () => {
    const flatten = (value: unknown, prefix = ''): string[] => {
      if (typeof value === 'string') return [prefix];
      if (value === null || typeof value !== 'object') return [];
      return Object.entries(value).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
      );
    };

    expect(flatten(loadLocale('de')).sort()).toEqual(
      flatten(loadLocale('en')).sort(),
    );
  });
});
