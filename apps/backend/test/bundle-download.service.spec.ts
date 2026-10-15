import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  spyOn,
} from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import AdmZip from 'adm-zip';
import { eq } from 'drizzle-orm';
import {
  ContractStatus,
  DocumentKind,
  InvoiceStatus,
  ReimbursementTypeKey,
  SigneeType,
} from '../src/accounting/enums';
import { BundleDownloadService } from '../src/accounting/services/bundle-download.service';
import { ContractService } from '../src/accounting/services/contract.service';
import { ReimbursementRateService } from '../src/accounting/services/reimbursement-rate.service';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import { MembershipService } from '../src/membership/membership.service';
import { OrganizationUnitDataService } from '../src/organization/organization-unit-data.service';
import { PostHogService } from '../src/shared/observability/posthog.service';
import { FilePurpose, FileStatus, FileVisibility } from '../src/storage/enums';
import { FileService } from '../src/storage/services/file.service';
import {
  createCompletedTimeEntry,
  createReimbursementType,
  createTwoStepTemplate,
  stubInvoiceDocumentNumber,
} from './factories/accounting.factory';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { createPermission } from './factories/role.factory';
import { createUser } from './factories/user.factory';
import {
  closeTestingModuleAfterAll,
  ensureTestDatabase,
} from './helpers/ensure-test-database';

describe('BundleDownloadService', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let service: BundleDownloadService;
  let fetchSpy: ReturnType<typeof spyOn>;
  let failUrlResolution = false;

  closeTestingModuleAfterAll(() => moduleRef);
  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);

    // Only `findCoveringContracts` is used, so the other collaborators are stubs.
    const contractService = new ContractService(
      db,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { capture: () => {} } as unknown as PostHogService,
    );
    const reimbursementRateService = new ReimbursementRateService(
      db,
      new OrganizationUnitDataService(db),
      {} as MembershipService,
      { capture: () => {} } as unknown as PostHogService,
    );
    const fileService = {
      resolvePublicUrlForUploadedFile: async (fileId: string) => {
        if (failUrlResolution) throw new Error('file is not uploaded');
        return `https://files.test/${fileId}`;
      },
    } as unknown as FileService;
    service = new BundleDownloadService(
      db,
      fileService,
      reimbursementRateService,
      contractService,
    );
  });

  beforeEach(() => {
    failUrlResolution = false;
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      (async () =>
        new Response(
          new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        )) as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const setup = async () => {
    const reimbursementType = await createReimbursementType(db);
    const { organization, type } = await createOrganizationWithType(
      db,
      `Bundle Org ${crypto.randomUUID()}`,
    );
    const root = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'root',
    });
    const permission = await createPermission(db, {
      key: `accounting:manage:${crypto.randomUUID()}`,
    });
    const templateArgs = {
      organizationId: organization.id,
      reimbursementTypeId: reimbursementType.id,
      requiredPermissionId: permission.id,
      signeeTypes: [SigneeType.VOLUNTEER, SigneeType.PERMISSION_HOLDER] as [
        SigneeType,
        SigneeType,
      ],
    };
    const contractTemplate = await createTwoStepTemplate(db, {
      ...templateArgs,
      kind: DocumentKind.CONTRACT,
    });
    const invoiceTemplate = await createTwoStepTemplate(db, {
      ...templateArgs,
      kind: DocumentKind.INVOICE,
    });
    const volunteer = await createUser(db);
    const downloader = await createUser(db);
    return {
      organization,
      type,
      root,
      reimbursementType,
      contractTemplate,
      invoiceTemplate,
      volunteer,
      downloader,
    };
  };
  type Fixture = Awaited<ReturnType<typeof setup>>;

  const createPdfFile = async (s: Fixture) => {
    const [file] = await db
      .insert(schema.files)
      .values({
        storageKey: `bundle-test/${crypto.randomUUID()}.pdf`,
        bucket: 'test',
        visibility: FileVisibility.PUBLIC,
        purpose: FilePurpose.DOCUMENT,
        mimeType: 'application/pdf',
        filename: 'document.pdf',
        byteSize: 4,
        status: FileStatus.UPLOADED,
        uploadedByUserId: s.volunteer.id,
        organizationUnitId: s.root.id,
        uploadedAt: new Date(),
      })
      .returning();
    if (!file) throw new Error('failed to insert file');
    return file;
  };

  /** Berlin day bounds as ISO instants, so a spec reads as calendar dates. */
  const JULY = {
    start: '2026-06-30T22:00:00.000Z',
    end: '2026-07-31T22:00:00.000Z',
  };

  const insertContract = async (
    s: Fixture,
    period: { start: string; end: string },
    options: {
      status?: ContractStatus;
      withFile?: boolean;
      createdAt?: string;
      volunteerId?: string;
      unitId?: string;
      reimbursementTypeId?: string;
    } = {},
  ) => {
    const file = options.withFile === false ? null : await createPdfFile(s);
    const [contract] = await db
      .insert(schema.contracts)
      .values({
        documentTemplateId: s.contractTemplate.id,
        volunteerId: options.volunteerId ?? s.volunteer.id,
        reimbursementTypeId:
          options.reimbursementTypeId ?? s.reimbursementType.id,
        organizationUnitId: options.unitId ?? s.root.id,
        contractStatus: options.status ?? ContractStatus.ACTIVE,
        periodStart: new Date(period.start),
        periodEnd: new Date(period.end),
        resolvedBody: { header: {}, blocks: [], footer: {} },
        fileId: file?.id ?? null,
        ...(options.createdAt
          ? { createdAt: new Date(options.createdAt) }
          : {}),
      })
      .returning();
    if (!contract) throw new Error('failed to insert contract');
    return contract;
  };

  const entryAt = (s: Fixture, startedAt: string) =>
    createCompletedTimeEntry(db, {
      organizationUnitId: s.root.id,
      volunteerId: s.volunteer.id,
      reimbursementTypeId: s.reimbursementType.id,
      startedAt: new Date(startedAt),
      endedAt: new Date(new Date(startedAt).getTime() + 2 * 3_600_000),
    });

  /** A READY, unpaid timesheet with a PDF, claiming the given entries. */
  const readyTimesheet = async (
    s: Fixture,
    entries: { id: string }[],
    options: {
      paid?: boolean | Date;
      period?: { start: string; end: string };
    } = {},
  ) => {
    const file = await createPdfFile(s);
    const [invoice] = await db
      .insert(schema.invoices)
      .values({
        documentTemplateId: s.invoiceTemplate.id,
        volunteerId: s.volunteer.id,
        reimbursementTypeId: s.reimbursementType.id,
        organizationUnitId: s.root.id,
        invoiceStatus: InvoiceStatus.READY,
        periodStart: new Date((options.period ?? JULY).start),
        periodEnd: new Date((options.period ?? JULY).end),
        totalAmountCents: 3_000,
        totalHours: 2,
        hourlyRateCents: 1_500,
        resolvedBody: { header: {}, blocks: [], footer: {} },
        fileId: file.id,
        paidAt:
          options.paid instanceof Date
            ? options.paid
            : options.paid
              ? new Date()
              : null,
        ...stubInvoiceDocumentNumber(s.root.id),
      })
      .returning();
    if (!invoice) throw new Error('failed to insert invoice');
    await db.insert(schema.invoiceTimeEntries).values(
      entries.map((entry) => ({
        invoiceId: invoice.id,
        timeEntryId: entry.id,
      })),
    );
    return invoice;
  };

  const download = (s: Fixture) =>
    service.buildAndRecord(
      s.root.id,
      s.volunteer.id,
      s.reimbursementType.id,
      s.downloader.id,
    );

  // adm-zip keeps its entries sorted by name, so the order they were added in
  // is not observable in the ZIP: compare sorted names.
  const zipNames = (buffer: Buffer) =>
    new AdmZip(buffer)
      .getEntries()
      .map((entry) => entry.entryName)
      .sort();
  const sorted = (names: string[]) => [...names].sort();
  /** Entry names in the order they were written, for the order tests. */
  const zipOrder = (buffer: Buffer) =>
    new AdmZip(buffer, { noSort: true })
      .getEntries()
      .map((entry) => entry.entryName);
  const contractName = (id: string) =>
    `Vereinbarung-${id.slice(0, 8)}-${id.slice(8, 12)}.pdf`;
  const timesheetName = (id: string) =>
    `Stundennachweis-${id.slice(0, 8)}-${id.slice(8, 12)}.pdf`;

  describe('characterisation of today’s behaviour', () => {
    it('zips the contract and the READY timesheet and names the file after the volunteer', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const contract = await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer, zipName } = await download(s);

      expect(zipName).toBe(`Abrechnung-${s.volunteer.id.slice(0, 8)}.zip`);
      expect(zipNames(buffer)).toEqual(
        sorted([contractName(contract.id), timesheetName(invoice.id)]),
      );
    });

    it('marks the downloaded timesheets paid and records the download', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);

      await download(s);

      const stored = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(stored?.paidAt).not.toBeNull();
      expect(stored?.paidByUserId).toBe(s.downloader.id);
      const audit = await db.query.reimbursementBundleDownloads.findFirst({
        where: {
          volunteerId: s.volunteer.id,
          reimbursementTypeId: s.reimbursementType.id,
        },
      });
      expect(audit?.downloadedByUserId).toBe(s.downloader.id);
    });

    it('rejects when there is nothing to download and marks nothing', async () => {
      const s = await setup();

      await expect(download(s)).rejects.toThrow(
        'No ready documents to download',
      );

      const audit = await db.query.reimbursementBundleDownloads.findFirst({
        where: { volunteerId: s.volunteer.id },
      });
      expect(audit).toBeUndefined();
    });

    it('marks nothing paid when a file URL cannot be resolved', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);
      failUrlResolution = true;

      await expect(download(s)).rejects.toThrow('file is not uploaded');

      const stored = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(stored?.paidAt).toBeNull();
    });

    it('fails and marks nothing paid when a timesheet PDF cannot be fetched', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);
      fetchSpy.mockImplementation((async (url: unknown) =>
        String(url).endsWith(String(invoice.fileId))
          ? new Response('missing', { status: 404 })
          : new Response(
              new Uint8Array([0x25, 0x50, 0x44, 0x46]),
            )) as unknown as typeof fetch);

      await expect(download(s)).rejects.toThrow('could not be fetched');

      const stored = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(stored?.paidAt).toBeNull();
      const audit = await db.query.reimbursementBundleDownloads.findFirst({
        where: { volunteerId: s.volunteer.id },
      });
      expect(audit).toBeUndefined();
    });

    it('still delivers the timesheets when only a contract PDF cannot be fetched', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const contract = await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);
      fetchSpy.mockImplementation((async (url: unknown) =>
        String(url).endsWith(String(contract.fileId))
          ? new Response('missing', { status: 404 })
          : new Response(
              new Uint8Array([0x25, 0x50, 0x44, 0x46]),
            )) as unknown as typeof fetch);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual([timesheetName(invoice.id)]);
      const stored = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(stored?.paidAt).not.toBeNull();
    });

    it('has nothing to download when there is no timesheet at all, paid or not', async () => {
      const s = await setup();
      await insertContract(s, JULY);

      await expect(download(s)).rejects.toThrow(
        'No ready documents to download',
      );
    });
  });

  describe('downloading again', () => {
    it('serves the last downloaded batch again when nothing new is ready', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const contract = await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);

      const first = await download(s);
      const second = await download(s);

      expect(zipNames(second.buffer)).toEqual(zipNames(first.buffer));
      expect(zipNames(second.buffer)).toEqual(
        sorted([contractName(contract.id), timesheetName(invoice.id)]),
      );
    });

    it('keeps the original payment stamp and records the new download', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);
      await download(s);
      const afterFirst = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      const otherUser = await createUser(db);

      await service.buildAndRecord(
        s.root.id,
        s.volunteer.id,
        s.reimbursementType.id,
        otherUser.id,
      );

      const afterSecond = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(afterSecond?.paidAt?.getTime()).toBe(
        afterFirst?.paidAt?.getTime(),
      );
      expect(afterSecond?.paidByUserId).toBe(s.downloader.id);
      const audit = await db.query.reimbursementBundleDownloads.findFirst({
        where: {
          volunteerId: s.volunteer.id,
          reimbursementTypeId: s.reimbursementType.id,
        },
      });
      expect(audit?.downloadedByUserId).toBe(otherUser.id);
    });

    it('bundles the paid and the newly ready timesheets together', async () => {
      const s = await setup();
      const paidEntry = await entryAt(s, '2026-07-05T09:00:00.000Z');
      const freshEntry = await entryAt(s, '2026-07-20T09:00:00.000Z');
      const contract = await insertContract(s, JULY);
      const paid = await readyTimesheet(s, [paidEntry], { paid: true });
      const fresh = await readyTimesheet(s, [freshEntry]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(
        sorted([
          contractName(contract.id),
          timesheetName(paid.id),
          timesheetName(fresh.id),
        ]),
      );
    });

    it('pays only the timesheets that were not paid yet', async () => {
      const s = await setup();
      const paidEntry = await entryAt(s, '2026-07-05T09:00:00.000Z');
      const freshEntry = await entryAt(s, '2026-07-20T09:00:00.000Z');
      await insertContract(s, JULY);
      const paidAt = new Date('2026-08-01T10:00:00.000Z');
      const paid = await readyTimesheet(s, [paidEntry], { paid: paidAt });
      const fresh = await readyTimesheet(s, [freshEntry]);

      await download(s);

      const storedPaid = await db.query.invoices.findFirst({
        where: { id: paid.id },
      });
      const storedFresh = await db.query.invoices.findFirst({
        where: { id: fresh.id },
      });
      expect(storedPaid?.paidAt?.getTime()).toBe(paidAt.getTime());
      expect(storedFresh?.paidAt).not.toBeNull();
    });

    it('grows by one: three timesheets, then four', async () => {
      const s = await setup();
      await insertContract(s, JULY);
      const first = await Promise.all(
        ['2026-07-03', '2026-07-10', '2026-07-17'].map(async (day) =>
          readyTimesheet(s, [await entryAt(s, `${day}T09:00:00.000Z`)]),
        ),
      );
      expect(zipNames((await download(s)).buffer).length).toBe(
        first.length + 1,
      );

      const added = await readyTimesheet(s, [
        await entryAt(s, '2026-07-24T09:00:00.000Z'),
      ]);

      const names = zipNames((await download(s)).buffer);
      expect(names).toHaveLength(first.length + 2);
      expect(names).toContain(timesheetName(added.id));
      for (const invoice of first) {
        expect(names).toContain(timesheetName(invoice.id));
      }
    });
  });

  describe('timesheets named by the board', () => {
    const downloadOnly = (s: Fixture, invoiceIds: string[]) =>
      service.buildAndRecord(
        s.root.id,
        s.volunteer.id,
        s.reimbursementType.id,
        s.downloader.id,
        invoiceIds,
      );

    it('bundles exactly the timesheets named, paid or not', async () => {
      const s = await setup();
      const a = await readyTimesheet(s, [
        await entryAt(s, '2026-07-05T09:00:00.000Z'),
      ]);
      const b = await readyTimesheet(
        s,
        [await entryAt(s, '2026-07-12T09:00:00.000Z')],
        { paid: true },
      );
      const c = await readyTimesheet(s, [
        await entryAt(s, '2026-07-20T09:00:00.000Z'),
      ]);

      const { buffer } = await downloadOnly(s, [a.id, b.id]);

      const names = zipNames(buffer);
      expect(names).toContain(timesheetName(a.id));
      expect(names).toContain(timesheetName(b.id));
      expect(names).not.toContain(timesheetName(c.id));
      const storedC = await db.query.invoices.findFirst({
        where: { id: c.id },
      });
      expect(storedC?.paidAt).toBeNull();
    });

    it('ignores a named timesheet of another volunteer', async () => {
      const s = await setup();
      const other = await setup();
      const mine = await readyTimesheet(s, [
        await entryAt(s, '2026-07-05T09:00:00.000Z'),
      ]);
      const theirs = await readyTimesheet(other, [
        await entryAt(other, '2026-07-05T09:00:00.000Z'),
      ]);

      const { buffer } = await downloadOnly(s, [mine.id, theirs.id]);

      const names = zipNames(buffer);
      expect(names).toContain(timesheetName(mine.id));
      expect(names).not.toContain(timesheetName(theirs.id));
    });

    it('rejects when none of the named timesheets is ready', async () => {
      const s = await setup();
      await readyTimesheet(s, [await entryAt(s, '2026-07-05T09:00:00.000Z')]);

      await expect(downloadOnly(s, [crypto.randomUUID()])).rejects.toThrow(
        'No ready documents to download',
      );
    });
  });

  describe('contracts that cover the timesheets’ hours (VOLI-1586)', () => {
    const FIRST_HALF = {
      start: '2026-06-30T22:00:00.000Z',
      end: '2026-07-15T22:00:00.000Z',
    };
    const SECOND_HALF = {
      start: '2026-07-15T22:00:00.000Z',
      end: '2026-07-31T22:00:00.000Z',
    };

    it('contains both contracts when one timesheet spans two of them, then the timesheet', async () => {
      const s = await setup();
      const early = await entryAt(s, '2026-07-05T09:00:00.000Z');
      const late = await entryAt(s, '2026-07-20T09:00:00.000Z');
      const first = await insertContract(s, FIRST_HALF);
      const second = await insertContract(s, SECOND_HALF);
      const invoice = await readyTimesheet(s, [early, late]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(
        sorted([
          contractName(first.id),
          contractName(second.id),
          timesheetName(invoice.id),
        ]),
      );
    });

    it('contains only the newest of two contracts that cover the same time', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      await insertContract(s, JULY, { createdAt: '2026-06-01T10:00:00.000Z' });
      const newest = await insertContract(s, JULY, {
        createdAt: '2026-06-20T10:00:00.000Z',
      });
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(
        sorted([contractName(newest.id), timesheetName(invoice.id)]),
      );
    });

    it('contains the union of covering contracts of several timesheets, each once', async () => {
      const s = await setup();
      const a = await entryAt(s, '2026-07-05T09:00:00.000Z');
      const b = await entryAt(s, '2026-07-08T09:00:00.000Z');
      const c = await entryAt(s, '2026-07-20T09:00:00.000Z');
      const first = await insertContract(s, FIRST_HALF);
      const second = await insertContract(s, SECOND_HALF);
      const sheetOne = await readyTimesheet(s, [a]);
      const sheetTwo = await readyTimesheet(s, [b, c]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(
        sorted([
          contractName(first.id),
          contractName(second.id),
          timesheetName(sheetOne.id),
          timesheetName(sheetTwo.id),
        ]),
      );
      // One fetch per document: the ZIP collapses a duplicate name, so only
      // the fetch count shows a contract that was resolved twice.
      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it('leaves out an old ACTIVE contract that covers none of the hours', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      // Inserted first, so an unordered findFirst over the volunteer's ACTIVE
      // contracts would return this one.
      await insertContract(s, {
        start: '2025-12-31T23:00:00.000Z',
        end: '2026-03-31T22:00:00.000Z',
      });
      const covering = await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(
        sorted([contractName(covering.id), timesheetName(invoice.id)]),
      );
    });

    for (const [label, status] of [
      ['draft', ContractStatus.DRAFT],
      ['awaiting signature', ContractStatus.AWAITING_VOLUNTEER_SIGNATURE],
      ['declined', ContractStatus.DECLINED],
    ] as const) {
      it(`never includes a ${label} contract`, async () => {
        const s = await setup();
        const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
        await insertContract(s, JULY, { status });
        const invoice = await readyTimesheet(s, [entry]);

        const { buffer } = await download(s);

        expect(zipNames(buffer)).toEqual(sorted([timesheetName(invoice.id)]));
      });
    }

    it('still builds the bundle from the timesheets when no contract covers any entry, and marks them paid', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(sorted([timesheetName(invoice.id)]));
      const stored = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(stored?.paidAt).not.toBeNull();
    });

    it('skips a covering contract that has no file', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      await insertContract(s, JULY, { withFile: false });
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(sorted([timesheetName(invoice.id)]));
    });

    it('does not use an older contract with a file in place of the newest one that has none', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      await insertContract(s, JULY, { createdAt: '2026-06-01T10:00:00.000Z' });
      await insertContract(s, JULY, {
        createdAt: '2026-06-20T10:00:00.000Z',
        withFile: false,
      });
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(sorted([timesheetName(invoice.id)]));
    });

    it('does not include a contract of another volunteer, another unit or another type', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const otherVolunteer = await createUser(db);
      const sibling = await createUnit(db, {
        organizationId: s.organization.id,
        typeId: s.type.id,
        name: 'sibling',
        parentId: s.root.id,
      });
      await insertContract(s, JULY, { volunteerId: otherVolunteer.id });
      await insertContract(s, JULY, { unitId: sibling.id });
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(sorted([timesheetName(invoice.id)]));
    });

    it('does not count an entry that starts exactly when the contract ends', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-15T22:00:00.000Z');
      await insertContract(s, FIRST_HALF);
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(sorted([timesheetName(invoice.id)]));
    });

    it('chooses contracts for the hours of a paid timesheet as well', async () => {
      const s = await setup();
      const paidEntry = await entryAt(s, '2026-07-05T09:00:00.000Z');
      const openEntry = await entryAt(s, '2026-07-20T09:00:00.000Z');
      const first = await insertContract(s, FIRST_HALF);
      const second = await insertContract(s, SECOND_HALF);
      const paid = await readyTimesheet(s, [paidEntry], { paid: true });
      const invoice = await readyTimesheet(s, [openEntry]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(
        sorted([
          contractName(first.id),
          contractName(second.id),
          timesheetName(paid.id),
          timesheetName(invoice.id),
        ]),
      );
    });

    it('puts the contracts ahead of the timesheets, oldest period first', async () => {
      const s = await setup();
      const early = await entryAt(s, '2026-07-05T09:00:00.000Z');
      const late = await entryAt(s, '2026-07-20T09:00:00.000Z');
      // Inserted newest period first on purpose.
      const second = await insertContract(s, SECOND_HALF);
      const first = await insertContract(s, FIRST_HALF);
      const sheetOne = await readyTimesheet(s, [early]);
      const sheetTwo = await readyTimesheet(s, [late]);

      const { buffer } = await download(s);

      const order = zipOrder(buffer);
      expect(order.slice(0, 2)).toEqual([
        contractName(first.id),
        contractName(second.id),
      ]);
      expect(sorted(order.slice(2))).toEqual(
        sorted([timesheetName(sheetOne.id), timesheetName(sheetTwo.id)]),
      );
    });

    it('does not pull in a contract of another reimbursement type when a claimed entry was moved to it', async () => {
      const s = await setup();
      const other = await createReimbursementType(db, {
        key: ReimbursementTypeKey.UEBUNGSLEITER,
      });
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const invoice = await readyTimesheet(s, [entry]);
      // A coordinator edits the claimed entry's type after the timesheet was
      // issued; the type-B contract covers that date but is not this bundle's.
      await db
        .update(schema.timeEntries)
        .set({ reimbursementTypeId: other.id })
        .where(eq(schema.timeEntries.id, entry.id));
      await insertContract(s, JULY, { reimbursementTypeId: other.id });

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual([timesheetName(invoice.id)]);
    });

    it('does not read claims that were released from the timesheet', async () => {
      const s = await setup();
      const kept = await entryAt(s, '2026-07-05T09:00:00.000Z');
      const released = await entryAt(s, '2026-07-20T09:00:00.000Z');
      const first = await insertContract(s, FIRST_HALF);
      await insertContract(s, SECOND_HALF);
      const invoice = await readyTimesheet(s, [kept, released]);
      await db
        .update(schema.invoiceTimeEntries)
        .set({ released: true })
        .where(eq(schema.invoiceTimeEntries.timeEntryId, released.id));

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual(
        sorted([contractName(first.id), timesheetName(invoice.id)]),
      );
    });
  });
});
