import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Database } from '../../database/database.module';
import { TermsChangeClass } from '../enums';
import { sha256File } from '../terms-files';
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

function makeAcceptanceService(opts: {
  directory: string;
  user: { termsVersion: string | null; locale: string | null } | null;
  inserted: Record<string, unknown>[];
}): TermsService {
  const db = {
    select: () => ({ from: async () => [] }),
    query: { users: { findFirst: async () => opts.user } },
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        opts.inserted.push(values);
      },
    }),
  } as unknown as Database;
  return new TermsService(db, opts.directory);
}

function makeAcceptService(opts: {
  directory: string;
  ledger: LedgerRow[];
  user: { termsVersion: string | null } | null;
  existingAcceptance: Record<string, unknown> | null;
}): {
  service: TermsService;
  rows: Record<string, unknown>[];
  updates: Record<string, unknown>[];
} {
  const rows = opts.existingAcceptance ? [opts.existingAcceptance] : [];
  const updates: Record<string, unknown>[] = [];
  const tx = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push(values);
        },
      }),
    }),
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        rows.push(values);
      },
    }),
  };
  const db = {
    select: () => ({ from: async () => opts.ledger }),
    query: {
      users: { findFirst: async () => opts.user },
      termsAcceptances: { findFirst: async () => opts.existingAcceptance },
    },
    transaction: async (callback: (tx: unknown) => Promise<void>) =>
      callback(tx),
  } as unknown as Database;
  return { service: new TermsService(db, opts.directory), rows, updates };
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

  it('stays inert when files exist but nothing is published', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    writeFileSync(join(directory, 'terms_1.0_2026-09-01_en.pdf'), '');
    writeFileSync(join(directory, 'terms_1.0_2026-09-01_de.pdf'), '');
    const service = makeService([], directory);

    await expect(service.mustAccept(null)).resolves.toBe(false);
    await expect(service.mustAccept('0.9')).resolves.toBe(false);
  });
});

describe('TermsService.recordSignupAcceptance', () => {
  it('does nothing when the user has no stamped version', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    const inserted: Record<string, unknown>[] = [];
    const service = makeAcceptanceService({
      directory,
      user: { termsVersion: null, locale: 'en' },
      inserted,
    });

    await service.recordSignupAcceptance('user-1');

    expect(inserted).toHaveLength(0);
  });

  it('inserts an acceptance row using the user locale document', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    const enPath = join(directory, 'terms_1.0_2026-10-06_en.pdf');
    writeFileSync(enPath, 'english terms');
    writeFileSync(join(directory, 'terms_1.0_2026-10-06_de.pdf'), 'deutsche');

    const inserted: Record<string, unknown>[] = [];
    const service = makeAcceptanceService({
      directory,
      user: { termsVersion: '1.0', locale: 'en' },
      inserted,
    });

    await service.recordSignupAcceptance('user-1');

    expect(inserted).toEqual([
      {
        userId: 'user-1',
        version: '1.0',
        class: TermsChangeClass.MAJOR,
        language: 'en',
        documentFilename: 'terms_1.0_2026-10-06_en.pdf',
        documentHash: sha256File(enPath),
      },
    ]);
  });

  it('falls back to German for a non-English user locale', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    writeFileSync(join(directory, 'terms_1.0_2026-10-06_en.pdf'), 'english');
    const dePath = join(directory, 'terms_1.0_2026-10-06_de.pdf');
    writeFileSync(dePath, 'deutsch');

    const inserted: Record<string, unknown>[] = [];
    const service = makeAcceptanceService({
      directory,
      user: { termsVersion: '1.0', locale: null },
      inserted,
    });

    await service.recordSignupAcceptance('user-1');

    expect(inserted[0]).toMatchObject({
      language: 'de',
      documentFilename: 'terms_1.0_2026-10-06_de.pdf',
      documentHash: sha256File(dePath),
    });
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

describe('TermsService cache', () => {
  it('shares a single ledger read between getCurrentVersion and mustAccept', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    let reads = 0;
    const db = {
      select: () => ({
        from: async () => {
          reads += 1;
          return [
            {
              version: '1.0',
              class: TermsChangeClass.MAJOR,
              publishedAt: new Date('2026-10-06T00:00:00.000Z'),
            },
          ];
        },
      }),
    } as unknown as Database;
    const service = new TermsService(db, directory);

    await service.getCurrentVersion();
    await service.mustAccept(null);

    expect(reads).toBe(1);
  });
});

describe('TermsService.accept', () => {
  function setup(
    existingAcceptance: Record<string, unknown> | null,
    userTermsVersion: string | null,
  ) {
    const directory = mkdtempSync(join(tmpdir(), 'terms-'));
    writeFileSync(join(directory, 'terms_1.0_2026-10-06_en.pdf'), 'english');
    writeFileSync(join(directory, 'terms_1.0_2026-10-06_de.pdf'), 'deutsch');
    return makeAcceptService({
      directory,
      ledger: [
        {
          version: '1.0',
          class: TermsChangeClass.MAJOR,
          publishedAt: new Date('2026-10-06T00:00:00.000Z'),
        },
      ],
      user: { termsVersion: userTermsVersion },
      existingAcceptance,
    });
  }

  it('does not insert again when the current version is already accepted', async () => {
    const { service, rows, updates } = setup(
      { id: 'acc-1', userId: 'user-1', version: '1.0' },
      '1.0',
    );

    await service.accept({ userId: 'user-1', version: '1.0', language: 'en' });

    expect(rows).toHaveLength(1);
    expect(updates).toHaveLength(0);
  });

  it('stamps and records when the current version is not yet accepted', async () => {
    const { service, rows, updates } = setup(null, null);

    await service.accept({ userId: 'user-1', version: '1.0', language: 'en' });

    expect(rows).toHaveLength(1);
    expect(updates).toHaveLength(1);
  });
});
