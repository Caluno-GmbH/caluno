import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TermsChangeClass } from './enums';
import {
  compareVersions,
  defaultTermsDirectory,
  isTermsLocale,
  listTermsDocuments,
  parseTermsFilename,
  pickCurrentTermsVersion,
  sha256File,
  termsChangeClassForVersion,
} from './terms-files';

describe('parseTermsFilename', () => {
  it('parses version, date and locale', () => {
    expect(parseTermsFilename('terms_1.1_2026-09-10_en.pdf')).toEqual({
      version: '1.1',
      major: 1,
      minor: 1,
      date: '2026-09-10',
      locale: 'en',
      filename: 'terms_1.1_2026-09-10_en.pdf',
    });
  });

  it('returns null for unrelated or malformed names', () => {
    expect(parseTermsFilename('datenschutzhinweise-2026-09-08.pdf')).toBeNull();
    expect(parseTermsFilename('terms_1.1_en.pdf')).toBeNull();
    expect(parseTermsFilename('terms_1.1_2026-09-10_fr.pdf')).toBeNull();
  });
});

describe('termsChangeClassForVersion', () => {
  it('treats X.0 as major and X.Y as minor', () => {
    expect(termsChangeClassForVersion('2.0')).toBe(TermsChangeClass.MAJOR);
    expect(termsChangeClassForVersion('1.1')).toBe(TermsChangeClass.MINOR);
  });
});

describe('compareVersions', () => {
  it('orders numerically by major then minor', () => {
    expect(compareVersions('1.1', '1.0')).toBeGreaterThan(0);
    expect(compareVersions('2.0', '1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.1', '1.1')).toBe(0);
  });
});

describe('listTermsDocuments + pickCurrentTermsVersion', () => {
  it('lists valid files and picks the highest version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'terms-'));
    writeFileSync(join(dir, 'terms_1.0_2026-09-01_en.pdf'), '');
    writeFileSync(join(dir, 'terms_1.1_2026-09-10_en.pdf'), '');
    writeFileSync(join(dir, 'terms_1.1_2026-09-10_de.pdf'), '');
    writeFileSync(join(dir, 'notes.md'), '');

    const docs = listTermsDocuments(dir);
    expect(docs).toHaveLength(3);
    expect(pickCurrentTermsVersion(docs)?.version).toBe('1.1');
  });
});

describe('isTermsLocale', () => {
  it('accepts the supported locales', () => {
    expect(isTermsLocale('en')).toBe(true);
    expect(isTermsLocale('de')).toBe(true);
  });

  it('rejects unsupported or mis-cased locales', () => {
    expect(isTermsLocale('fr')).toBe(false);
    expect(isTermsLocale('EN')).toBe(false);
    expect(isTermsLocale('')).toBe(false);
  });
});

describe('defaultTermsDirectory', () => {
  it('resolves to the backend legal directory', () => {
    expect(defaultTermsDirectory().endsWith('legal')).toBe(true);
  });
});

describe('sha256File', () => {
  it('hashes file bytes deterministically', () => {
    const dir = mkdtempSync(join(tmpdir(), 'terms-hash-'));
    const path = join(dir, 'doc.pdf');
    writeFileSync(path, 'hello');

    const hash = sha256File(path);
    // sha256('hello')
    expect(hash).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
    expect(sha256File(path)).toBe(hash);
  });
});
