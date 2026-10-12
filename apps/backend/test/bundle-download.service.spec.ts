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
import {
  ContractStatus,
  DocumentKind,
  InvoiceStatus,
  SigneeType,
} from '../src/accounting/enums';
import { BundleDownloadService } from '../src/accounting/services/bundle-download.service';
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
  ensureTestDatabase,
  registerTestResourceCleanup,
} from './helpers/ensure-test-database';

describe('BundleDownloadService', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let service: BundleDownloadService;
  let fetchSpy: ReturnType<typeof spyOn>;
  let failUrlResolution = false;

  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);

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
    );

    registerTestResourceCleanup(async () => {
      await moduleRef.close();
    });
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
    } = {},
  ) => {
    const file = options.withFile === false ? null : await createPdfFile(s);
    const [contract] = await db
      .insert(schema.contracts)
      .values({
        documentTemplateId: s.contractTemplate.id,
        volunteerId: options.volunteerId ?? s.volunteer.id,
        reimbursementTypeId: s.reimbursementType.id,
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
    options: { paid?: boolean } = {},
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
        periodStart: new Date(JULY.start),
        periodEnd: new Date(JULY.end),
        totalAmountCents: 3_000,
        totalHours: 2,
        hourlyRateCents: 1_500,
        resolvedBody: { header: {}, blocks: [], footer: {} },
        fileId: file.id,
        paidAt: options.paid ? new Date() : null,
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

    it('does not put an already paid timesheet back in the bundle', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const contract = await insertContract(s, JULY);
      const paid = await readyTimesheet(s, [entry], { paid: true });

      const { buffer } = await download(s);

      // Today the one ACTIVE contract is bundled on its own; the paid
      // timesheet is not in it.
      expect(zipNames(buffer)).toEqual([contractName(contract.id)]);
      expect(zipNames(buffer)).not.toContain(timesheetName(paid.id));
    });
  });
});
