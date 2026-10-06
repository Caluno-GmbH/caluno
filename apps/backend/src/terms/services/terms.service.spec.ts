import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Database } from '../../database/database.module';
import { TermsChangeClass } from '../enums';
import { computeMustAccept, TermsService } from './terms.service';

type LedgerRow = {
  version: string;
  class: TermsChangeClass;
  publishedAt: Date;
};

function makeService(rows: LedgerRow[], directory: string): TermsService {
  const db = {
    select: () => ({ from: async () => rows }),
  } as unknown as Database;
  return new TermsService(db, directory);
}

describe('computeMustAccept', () => {
  it('requires acceptance when there is no recorded acceptance', () => {
    expect(computeMustAccept(null, '1.0')).toBe(true);
    expect(computeMustAccept(undefined, '1.0')).toBe(true);
  });

  it('requires acceptance when behind the latest major', () => {
    expect(computeMustAccept('1.0', '2.0')).toBe(true);
  });

  it('does not require acceptance when on or ahead of the latest major', () => {
    expect(computeMustAccept('2.0', '2.0')).toBe(false);
    expect(computeMustAccept('2.1', '2.0')).toBe(false);
  });

  it('does not require acceptance when there is no major yet', () => {
    expect(computeMustAccept('1.0', null)).toBe(false);
    expect(computeMustAccept(null, null)).toBe(true);
  });
});

describe('TermsService.mustAccept', () => {
  it('does not require acceptance when no version is published', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    const service = makeService([], directory);

    await expect(service.mustAccept(null)).resolves.toBe(false);
    await expect(service.mustAccept(undefined)).resolves.toBe(false);
  });

  it('requires acceptance when a version is published and none was accepted', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    const service = makeService(
      [
        {
          version: '2.0',
          class: TermsChangeClass.MAJOR,
          publishedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
      directory,
    );

    await expect(service.mustAccept(null)).resolves.toBe(true);
    await expect(service.mustAccept('1.0')).resolves.toBe(true);
    await expect(service.mustAccept('2.0')).resolves.toBe(false);
  });
});

describe('TermsService.getCurrentVersion', () => {
  it('resolves the current version from the ledger when no PDF exists', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    const service = makeService(
      [
        {
          version: '2.0',
          class: TermsChangeClass.MAJOR,
          publishedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
      directory,
    );

    await expect(service.getCurrentVersion()).resolves.toEqual({
      version: '2.0',
      class: TermsChangeClass.MAJOR,
      date: '2026-01-02',
    });
  });

  it('trusts the ledger class rather than deriving it from the version', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    const service = makeService(
      [
        {
          version: '2.1',
          class: TermsChangeClass.MAJOR,
          publishedAt: new Date('2026-02-03T00:00:00.000Z'),
        },
      ],
      directory,
    );

    await expect(service.getCurrentVersion()).resolves.toMatchObject({
      version: '2.1',
      class: TermsChangeClass.MAJOR,
    });
  });

  it('enriches the ledger date from a matching PDF', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    writeFileSync(join(directory, 'terms_2.0_2026-09-01_en.pdf'), '');
    const service = makeService(
      [
        {
          version: '2.0',
          class: TermsChangeClass.MAJOR,
          publishedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
      directory,
    );

    await expect(service.getCurrentVersion()).resolves.toEqual({
      version: '2.0',
      class: TermsChangeClass.MAJOR,
      date: '2026-09-01',
    });
  });

  it('falls back to the highest file when the ledger is empty', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    writeFileSync(join(directory, 'terms_1.0_2026-09-01_en.pdf'), '');
    writeFileSync(join(directory, 'terms_1.1_2026-09-10_en.pdf'), '');
    const service = makeService([], directory);

    await expect(service.getCurrentVersion()).resolves.toEqual({
      version: '1.1',
      class: TermsChangeClass.MINOR,
      date: '2026-09-10',
    });
  });
});
