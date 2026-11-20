import { beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import AdmZip from 'adm-zip';
import { eq, inArray } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import {
  AccountingSettingSourceKind,
  BundleDeliveryIssue,
  BundleDeliveryMethod,
  ContractStatus,
  DocumentKind,
  InvoiceStatus,
  ReimbursementTypeKey,
  SigneeType,
} from '../src/accounting/enums';
import { AccountingDeliverySettingsService } from '../src/accounting/services/accounting-delivery-settings.service';
import { BundleDeliveryLogService } from '../src/accounting/services/bundle-delivery-log.service';
import { BundleDownloadService } from '../src/accounting/services/bundle-download.service';
import { BundleEmailService } from '../src/accounting/services/bundle-email.service';
import { ContractService } from '../src/accounting/services/contract.service';
import type { InvoiceService } from '../src/accounting/services/invoice.service';
import { ReimbursementRateService } from '../src/accounting/services/reimbursement-rate.service';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import { ConflictGraphQLError } from '../src/graphql/errors';
import type { AppI18nService } from '../src/i18n/app-i18n.service';
import { MembershipService } from '../src/membership/membership.service';
import type {
  EmailSendResult,
  EmailTransportService,
} from '../src/notification/email/email-transport.service';
import { EmailDeliveryStatus } from '../src/notification/email/outbox/email-outbox.enums';
import { EmailOutboxService } from '../src/notification/email/outbox/email-outbox.service';
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
  let getBytesCalls = 0;
  let failUrlResolution = false;
  /** Stands in for rendering a timesheet's missing PDF: the new file id, or null. */
  let renderMissingPdf: (
    invoiceId: string,
    actorUserId: string,
  ) => Promise<string | null>;
  const renderCalls: string[] = [];
  let withoutActiveCover = new Set<string>();
  let emailService: BundleEmailService;
  let outbox: EmailOutboxService;
  let sendResult: EmailSendResult;
  let settingsService: AccountingDeliverySettingsService;
  /** The same for a covering contract's missing PDF; none by default. */
  let renderMissingContractPdf: (contractId: string) => Promise<string | null>;

  /**
   * Every stored file is served as a PDF whose pages have a width of its own,
   * so the pages of a merged PDF show which document each came from.
   */
  const pageWidthByFileId = new Map<string, number>();
  const pageCountByFileId = new Map<string, number>();
  let getUploadedFileBytesImpl: (fileId: string) => Promise<Buffer>;
  const servePdfBytes = async (fileId: string): Promise<Buffer> => {
    getBytesCalls += 1;
    const doc = await PDFDocument.create();
    for (let i = 0; i < (pageCountByFileId.get(fileId) ?? 1); i++) {
      doc.addPage([pageWidthByFileId.get(fileId) ?? 1, 100]);
    }
    return Buffer.from(await doc.save());
  };
  const notAPdf = () => Buffer.from([0x25, 0x50, 0x44, 0x46]);

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
    getUploadedFileBytesImpl = servePdfBytes;
    const fileService = {
      getUploadedFileBytes: async (fileId: string) => {
        if (failUrlResolution) throw new Error('file is not uploaded');
        return getUploadedFileBytesImpl(fileId);
      },
    } as unknown as FileService;
    contractService.ensurePdf = (contractId: string) =>
      renderMissingContractPdf(contractId);
    const invoiceService = {
      ensurePdf: (invoiceId: string, actorUserId: string) => {
        renderCalls.push(invoiceId);
        return renderMissingPdf(invoiceId, actorUserId);
      },
      findInvoiceIdsWithoutActiveCover: async () => withoutActiveCover,
    } as unknown as InvoiceService;
    const deliveryLog = new BundleDeliveryLogService(db);
    service = new BundleDownloadService(
      db,
      fileService,
      reimbursementRateService,
      contractService,
      invoiceService,
      deliveryLog,
    );
    const unitData = new OrganizationUnitDataService(db);
    settingsService = new AccountingDeliverySettingsService(db, unitData);
    // Copy keys stand in for translations.
    const appI18n = {
      createTranslator: () => ({ t: (key: string) => key }),
    } as unknown as AppI18nService;
    outbox = new EmailOutboxService(db, {
      sendOnce: async () => sendResult,
    } as unknown as EmailTransportService);
    emailService = new BundleEmailService(
      db,
      service,
      settingsService,
      deliveryLog,
      reimbursementRateService,
      unitData,
      outbox,
      appI18n,
    );
    emailService.onModuleInit();
  });

  beforeEach(() => {
    sendResult = { ok: true, providerMessageId: null };
    withoutActiveCover = new Set();
    failUrlResolution = false;
    getBytesCalls = 0;
    getUploadedFileBytesImpl = servePdfBytes;
    renderCalls.length = 0;
    renderMissingContractPdf = async () => null;
    renderMissingPdf = async () => {
      throw new Error('no timesheet should need rendering');
    };
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
      reimbursementTypeKey: reimbursementType.key,
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
        storageKey: `private/${s.root.id}/${s.volunteer.id}/${crypto.randomUUID()}.pdf`,
        bucket: 'test',
        visibility: FileVisibility.PRIVATE,
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
    pageWidthByFileId.set(file.id, 100 + pageWidthByFileId.size);
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
      reimbursementTypeKey?: ReimbursementTypeKey;
    } = {},
  ) => {
    const file = options.withFile === false ? null : await createPdfFile(s);
    const [contract] = await db
      .insert(schema.contracts)
      .values({
        documentTemplateId: s.contractTemplate.id,
        volunteerId: options.volunteerId ?? s.volunteer.id,
        reimbursementTypeKey:
          options.reimbursementTypeKey ?? s.reimbursementType.key,
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
      reimbursementTypeKey: s.reimbursementType.key,
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
      unitId?: string;
      reimbursementTypeKey?: ReimbursementTypeKey;
      status?: InvoiceStatus;
      withFile?: boolean;
    } = {},
  ) => {
    const file = options.withFile === false ? null : await createPdfFile(s);
    const [invoice] = await db
      .insert(schema.invoices)
      .values({
        documentTemplateId: s.invoiceTemplate.id,
        volunteerId: s.volunteer.id,
        reimbursementTypeKey:
          options.reimbursementTypeKey ?? s.reimbursementType.key,
        organizationUnitId: options.unitId ?? s.root.id,
        invoiceStatus: options.status ?? InvoiceStatus.READY,
        periodStart: new Date((options.period ?? JULY).start),
        periodEnd: new Date((options.period ?? JULY).end),
        totalAmountCents: 3_000,
        totalHours: 2,
        hourlyRateCents: 1_500,
        resolvedBody: { header: {}, blocks: [], footer: {} },
        fileId: file?.id ?? null,
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
      s.organization.id,
      s.root.id,
      s.volunteer.id,
      s.reimbursementType.key,
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
  /** The pages of one PDF in the ZIP, each as the document it came from. */
  const pagesIn = async (buffer: Buffer, invoice: { id: string }) => {
    const entry = new AdmZip(buffer).getEntry(timesheetName(invoice.id));
    if (!entry)
      throw new Error(`${timesheetName(invoice.id)} is not in the ZIP`);
    const doc = await PDFDocument.load(entry.getData());
    return doc.getPages().map((page) => Math.round(page.getWidth()));
  };
  /** The page a document contributes, in the terms `pagesIn` returns. */
  const page = (doc: { fileId: string | null }) =>
    pageWidthByFileId.get(String(doc.fileId));
  const timesheetName = (id: string) =>
    `Stundennachweis-${id.slice(0, 8)}-${id.slice(8, 12)}.pdf`;

  describe('characterisation of today’s behaviour', () => {
    it('zips one PDF for the READY timesheet, the timesheet then its contract, and names the file after the volunteer', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const contract = await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer, zipName } = await download(s);

      expect(zipName).toBe(`Abrechnung-${s.volunteer.id.slice(0, 8)}.zip`);
      expect(zipNames(buffer)).toEqual([timesheetName(invoice.id)]);
      expect(await pagesIn(buffer, invoice)).toEqual([
        page(invoice),
        page(contract),
      ]);
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
          reimbursementTypeKey: s.reimbursementType.key,
        },
      });
      expect(audit?.downloadedByUserId).toBe(s.downloader.id);
    });

    it('rejects when there is nothing to download and marks nothing', async () => {
      const s = await setup();

      await expect(download(s)).rejects.toThrow(
        'No ready documents to download',
      );
      await expect(download(s)).rejects.toBeInstanceOf(BadRequestException);

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
      getUploadedFileBytesImpl = async (fileId: string) => {
        if (fileId === invoice.fileId) {
          throw new Error('HTTP 404');
        }
        return servePdfBytes(fileId);
      };

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
      getUploadedFileBytesImpl = async (fileId: string) => {
        if (fileId === contract.fileId) {
          throw new Error('HTTP 404');
        }
        return servePdfBytes(fileId);
      };

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual([timesheetName(invoice.id)]);
      expect(await pagesIn(buffer, invoice)).toEqual([page(invoice)]);
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

  describe('a READY timesheet whose PDF was never rendered (VOLI-1637)', () => {
    it('renders the PDF and bundles the timesheet', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const contract = await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry], { withFile: false });
      let renderedFileId = '';
      renderMissingPdf = async (invoiceId, actorUserId) => {
        expect(actorUserId).toBe(s.downloader.id);
        const file = await createPdfFile(s);
        await db
          .update(schema.invoices)
          .set({ fileId: file.id })
          .where(eq(schema.invoices.id, invoiceId));
        renderedFileId = file.id;
        return file.id;
      };

      const { buffer } = await download(s);

      expect(renderCalls).toEqual([invoice.id]);
      expect(zipNames(buffer)).toEqual([timesheetName(invoice.id)]);
      expect(await pagesIn(buffer, invoice)).toEqual([
        page({ fileId: renderedFileId }),
        page(contract),
      ]);
      const stored = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(stored?.paidAt).not.toBeNull();
    });

    it('fails with a server error and marks nothing paid when the PDF cannot be rendered', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const invoice = await readyTimesheet(s, [entry], { withFile: false });
      renderMissingPdf = async () => null;

      const attempt = download(s);
      await expect(attempt).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      await expect(attempt).rejects.toThrow('could not be generated');

      const stored = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(stored?.paidAt).toBeNull();
      const audit = await db.query.reimbursementBundleDownloads.findFirst({
        where: { volunteerId: s.volunteer.id },
      });
      expect(audit).toBeUndefined();
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
      expect(zipNames(second.buffer)).toEqual([timesheetName(invoice.id)]);
      expect(await pagesIn(second.buffer, invoice)).toEqual([
        page(invoice),
        page(contract),
      ]);
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
        s.organization.id,
        s.root.id,
        s.volunteer.id,
        s.reimbursementType.key,
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
          reimbursementTypeKey: s.reimbursementType.key,
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
        sorted([timesheetName(paid.id), timesheetName(fresh.id)]),
      );
      expect(await pagesIn(buffer, paid)).toEqual([page(paid), page(contract)]);
      expect(await pagesIn(buffer, fresh)).toEqual([
        page(fresh),
        page(contract),
      ]);
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
      expect(zipNames((await download(s)).buffer).length).toBe(first.length);

      const added = await readyTimesheet(s, [
        await entryAt(s, '2026-07-24T09:00:00.000Z'),
      ]);

      const names = zipNames((await download(s)).buffer);
      expect(names).toHaveLength(first.length + 1);
      expect(names).toContain(timesheetName(added.id));
      for (const invoice of first) {
        expect(names).toContain(timesheetName(invoice.id));
      }
    });
  });

  describe('timesheets named by the board', () => {
    const downloadOnly = (s: Fixture, invoiceIds: string[]) =>
      service.buildAndRecord(
        s.organization.id,
        s.root.id,
        s.volunteer.id,
        s.reimbursementType.key,
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

    it('ignores a named timesheet of the same volunteer in another unit', async () => {
      const s = await setup();
      const sibling = await createUnit(db, {
        organizationId: s.organization.id,
        typeId: s.type.id,
        name: 'sibling',
        parentId: s.root.id,
      });
      const mine = await readyTimesheet(s, [
        await entryAt(s, '2026-07-05T09:00:00.000Z'),
      ]);
      const elsewhere = await readyTimesheet(
        s,
        [await entryAt(s, '2026-07-12T09:00:00.000Z')],
        { unitId: sibling.id },
      );

      const { buffer } = await downloadOnly(s, [mine.id, elsewhere.id]);

      const names = zipNames(buffer);
      expect(names).toContain(timesheetName(mine.id));
      expect(names).not.toContain(timesheetName(elsewhere.id));
      const stored = await db.query.invoices.findFirst({
        where: { id: elsewhere.id },
      });
      expect(stored?.paidAt).toBeNull();
    });

    it('ignores a named timesheet of another reimbursement type', async () => {
      const s = await setup();
      const other = await createReimbursementType(db, {
        key: ReimbursementTypeKey.UEBUNGSLEITER,
      });
      const mine = await readyTimesheet(s, [
        await entryAt(s, '2026-07-05T09:00:00.000Z'),
      ]);
      const otherType = await readyTimesheet(
        s,
        [await entryAt(s, '2026-07-12T09:00:00.000Z')],
        { reimbursementTypeKey: other.key },
      );

      const { buffer } = await downloadOnly(s, [mine.id, otherType.id]);

      const names = zipNames(buffer);
      expect(names).toContain(timesheetName(mine.id));
      expect(names).not.toContain(timesheetName(otherType.id));
    });

    it('ignores a named timesheet that is not ready', async () => {
      const s = await setup();
      const mine = await readyTimesheet(s, [
        await entryAt(s, '2026-07-05T09:00:00.000Z'),
      ]);
      const unsigned = await readyTimesheet(
        s,
        [await entryAt(s, '2026-07-12T09:00:00.000Z')],
        { status: InvoiceStatus.AWAITING_SUPERVISOR_SIGNATURE },
      );

      const { buffer } = await downloadOnly(s, [mine.id, unsigned.id]);

      expect(zipNames(buffer)).not.toContain(timesheetName(unsigned.id));
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

    it('appends both contracts when one timesheet spans two of them', async () => {
      const s = await setup();
      const early = await entryAt(s, '2026-07-05T09:00:00.000Z');
      const late = await entryAt(s, '2026-07-20T09:00:00.000Z');
      const first = await insertContract(s, FIRST_HALF);
      const second = await insertContract(s, SECOND_HALF);
      const invoice = await readyTimesheet(s, [early, late]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual([timesheetName(invoice.id)]);
      expect(await pagesIn(buffer, invoice)).toEqual([
        page(invoice),
        page(first),
        page(second),
      ]);
    });

    it('appends only the newest of two contracts that cover the same time', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      await insertContract(s, JULY, { createdAt: '2026-06-01T10:00:00.000Z' });
      const newest = await insertContract(s, JULY, {
        createdAt: '2026-06-20T10:00:00.000Z',
      });
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer } = await download(s);

      expect(await pagesIn(buffer, invoice)).toEqual([
        page(invoice),
        page(newest),
      ]);
    });

    it('gives each timesheet its own covering contracts, fetching each document once', async () => {
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
        sorted([timesheetName(sheetOne.id), timesheetName(sheetTwo.id)]),
      );
      expect(await pagesIn(buffer, sheetOne)).toEqual([
        page(sheetOne),
        page(first),
      ]);
      expect(await pagesIn(buffer, sheetTwo)).toEqual([
        page(sheetTwo),
        page(first),
        page(second),
      ]);
      // Two timesheets and two contracts: a contract both timesheets need is
      // fetched once and appended to each.
      expect(getBytesCalls).toBe(4);
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

      expect(await pagesIn(buffer, invoice)).toEqual([
        page(invoice),
        page(covering),
      ]);
    });

    for (const [label, status] of [
      ['draft', ContractStatus.DRAFT],
      ['awaiting signature', ContractStatus.AWAITING_VOLUNTEER_SIGNATURE],
      ['declined', ContractStatus.DECLINED],
    ] as const) {
      it(`never appends a ${label} contract`, async () => {
        const s = await setup();
        const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
        await insertContract(s, JULY, { status });
        const invoice = await readyTimesheet(s, [entry]);

        const { buffer } = await download(s);

        expect(await pagesIn(buffer, invoice)).toEqual([page(invoice)]);
      });
    }

    it('delivers the timesheet alone when no contract covers any entry, and marks it paid', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer } = await download(s);

      expect(zipNames(buffer)).toEqual([timesheetName(invoice.id)]);
      expect(await pagesIn(buffer, invoice)).toEqual([page(invoice)]);
      const stored = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(stored?.paidAt).not.toBeNull();
    });

    it('renders the PDF of a covering contract that has none and appends it (VOLI-1637)', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const contract = await insertContract(s, JULY, { withFile: false });
      const invoice = await readyTimesheet(s, [entry]);
      const rendered = await createPdfFile(s);
      renderMissingContractPdf = async (contractId) =>
        contractId === contract.id ? rendered.id : null;

      const { buffer } = await download(s);

      expect(await pagesIn(buffer, invoice)).toEqual([
        page(invoice),
        page({ fileId: rendered.id }),
      ]);
    });

    it('skips a covering contract whose missing PDF cannot be rendered', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      await insertContract(s, JULY, { withFile: false });
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer } = await download(s);

      expect(await pagesIn(buffer, invoice)).toEqual([page(invoice)]);
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

      expect(await pagesIn(buffer, invoice)).toEqual([page(invoice)]);
    });

    it('does not append a contract of another volunteer, another unit or another type', async () => {
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

      expect(await pagesIn(buffer, invoice)).toEqual([page(invoice)]);
    });

    it('does not count an entry that starts exactly when the contract ends', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-15T22:00:00.000Z');
      await insertContract(s, FIRST_HALF);
      const invoice = await readyTimesheet(s, [entry]);

      const { buffer } = await download(s);

      expect(await pagesIn(buffer, invoice)).toEqual([page(invoice)]);
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

      expect(await pagesIn(buffer, paid)).toEqual([page(paid), page(first)]);
      expect(await pagesIn(buffer, invoice)).toEqual([
        page(invoice),
        page(second),
      ]);
    });

    it('puts the timesheet first, then its contracts oldest period first', async () => {
      const s = await setup();
      const early = await entryAt(s, '2026-07-05T09:00:00.000Z');
      const late = await entryAt(s, '2026-07-20T09:00:00.000Z');
      // Inserted newest period first on purpose.
      const second = await insertContract(s, SECOND_HALF);
      const first = await insertContract(s, FIRST_HALF);
      const invoice = await readyTimesheet(s, [late, early]);

      const { buffer } = await download(s);

      expect(await pagesIn(buffer, invoice)).toEqual([
        page(invoice),
        page(first),
        page(second),
      ]);
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
        .set({ reimbursementTypeKey: other.key })
        .where(eq(schema.timeEntries.id, entry.id));
      await insertContract(s, JULY, { reimbursementTypeKey: other.key });

      const { buffer } = await download(s);

      expect(await pagesIn(buffer, invoice)).toEqual([page(invoice)]);
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

      expect(await pagesIn(buffer, invoice)).toEqual([
        page(invoice),
        page(first),
      ]);
    });
  });

  describe('one PDF per timesheet (VOLI-1551)', () => {
    it('keeps every page of a multi-page timesheet ahead of every page of its contract', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const contract = await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);
      pageCountByFileId.set(String(invoice.fileId), 2);
      pageCountByFileId.set(String(contract.fileId), 3);

      const { buffer } = await download(s);

      expect(await pagesIn(buffer, invoice)).toEqual([
        page(invoice),
        page(invoice),
        page(contract),
        page(contract),
        page(contract),
      ]);
    });

    it('delivers the timesheet alone, still paid, when its contract file is not a readable PDF', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      const contract = await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);
      getUploadedFileBytesImpl = async (fileId: string) => {
        if (fileId === contract.fileId) {
          return notAPdf();
        }
        return servePdfBytes(fileId);
      };

      const { buffer } = await download(s);

      expect(await pagesIn(buffer, invoice)).toEqual([page(invoice)]);
      const stored = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(stored?.paidAt).not.toBeNull();
    });

    it('fails and marks nothing paid when a timesheet file is not a readable PDF', async () => {
      const s = await setup();
      const entry = await entryAt(s, '2026-07-10T09:00:00.000Z');
      await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [entry]);
      getUploadedFileBytesImpl = async (fileId: string) => {
        if (fileId === invoice.fileId) {
          return notAPdf();
        }
        return servePdfBytes(fileId);
      };

      await expect(download(s)).rejects.toThrow('could not be read');

      const stored = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(stored?.paidAt).toBeNull();
      const audit = await db.query.reimbursementBundleDownloads.findFirst({
        where: { volunteerId: s.volunteer.id },
      });
      expect(audit).toBeUndefined();
    });
  });

  describe('sending by email (VOLI-1766)', () => {
    const RECIPIENT = 'accounting@example.org';

    // Other spec files leave queued emails in this process's test database;
    // a drain handles at most 200, so clear them to reach this test's email.
    beforeEach(async () => {
      await db
        .update(schema.emailOutbox)
        .set({ status: EmailDeliveryStatus.CANCELLED })
        .where(
          inArray(schema.emailOutbox.status, [
            EmailDeliveryStatus.PENDING,
            EmailDeliveryStatus.SENDING,
          ]),
        );
    });

    const configure = (s: Fixture, unitId = s.root.id) =>
      settingsService.update(
        unitId,
        {
          deliveryMethod: BundleDeliveryMethod.EMAIL,
          recipientEmail: RECIPIENT,
          emailSubject: 'Abrechnung {volunteer} – {period}',
        },
        s.downloader.id,
      );

    const request = (s: Fixture, invoiceIds?: string[]) => ({
      organizationId: s.organization.id,
      scope: {
        volunteerId: s.volunteer.id,
        reimbursementTypeKey: s.reimbursementType.key,
        organizationUnitId: s.root.id,
      },
      invoiceIds,
      sender: { id: s.downloader.id, name: 'Sender' },
      locale: 'de' as const,
    });

    const send = async (
      s: Fixture,
      acknowledgedIssues: BundleDeliveryIssue[] = [],
    ) => {
      const shown = await emailService.preview(request(s));
      return emailService.send({
        ...request(s),
        acknowledgedIssues,
        expectedRecipientEmail: shown.recipientEmail ?? '',
        expectedSubject: shown.subject,
      });
    };

    const isPaid = async (invoiceId: string) =>
      (await db.query.invoices.findFirst({ where: { id: invoiceId } }))
        ?.paidAt != null;

    const deliveriesOf = (s: Fixture) =>
      db.query.reimbursementBundleDeliveries.findMany({
        where: { volunteerId: s.volunteer.id },
        orderBy: { occurredAt: 'asc' },
      });

    it('queues one email with a PDF per timesheet, logs the send and marks them paid once sent', async () => {
      const s = await setup();
      await configure(s);
      await insertContract(s, JULY);
      const a = await readyTimesheet(s, [
        await entryAt(s, '2026-07-05T09:00:00.000Z'),
      ]);
      const b = await readyTimesheet(s, [
        await entryAt(s, '2026-07-12T09:00:00.000Z'),
      ]);

      const delivery = await send(s);

      const [email] = await db
        .select()
        .from(schema.emailOutbox)
        .where(eq(schema.emailOutbox.id, delivery.emailOutboxId ?? ''));
      expect(email?.recipientEmail).toBe(RECIPIENT);
      expect(email?.status).toBe(EmailDeliveryStatus.PENDING);
      expect(email?.maxAttempts).toBe(1);
      expect(email?.subject).toBe(`Abrechnung ${s.volunteer.name} – Juli 2026`);
      expect(email?.attachments?.map((file) => file.filename).sort()).toEqual(
        [timesheetName(a.id), timesheetName(b.id)].sort(),
      );

      expect(delivery).toMatchObject({
        method: BundleDeliveryMethod.EMAIL,
        recipientEmail: RECIPIENT,
        subject: email?.subject,
        issues: [],
        emailStatus: EmailDeliveryStatus.PENDING,
        deliveredByUserId: s.downloader.id,
      });
      expect([...delivery.invoiceIds].sort()).toEqual([a.id, b.id].sort());
      expect(await isPaid(a.id)).toBe(false);

      await outbox.drain();

      const [settled] = await deliveriesOf(s);
      expect(settled?.emailStatus).toBe(EmailDeliveryStatus.SENT);
      for (const id of [a.id, b.id]) {
        const stored = await db.query.invoices.findFirst({ where: { id } });
        expect(stored?.paidByUserId).toBe(s.downloader.id);
      }
    });

    it('refuses when the address changed after the preview was shown', async () => {
      const s = await setup();
      await configure(s);
      await insertContract(s, JULY);
      await readyTimesheet(s, [await entryAt(s, '2026-07-05T09:00:00.000Z')]);
      const shown = await emailService.preview(request(s));
      await settingsService.update(
        s.root.id,
        { recipientEmail: 'elsewhere@example.org' },
        s.downloader.id,
      );

      await expect(
        emailService.send({
          ...request(s),
          acknowledgedIssues: [],
          expectedRecipientEmail: shown.recipientEmail ?? '',
          expectedSubject: shown.subject,
        }),
      ).rejects.toBeInstanceOf(ConflictGraphQLError);
      expect(await deliveriesOf(s)).toEqual([]);
    });

    it('refuses without a recipient and leaves nothing paid or logged', async () => {
      const s = await setup();
      // Email with no address: what a unit is left with when an ancestor's
      // address is cleared after the unit chose email.
      await db.insert(schema.accountingDeliverySettings).values({
        organizationId: s.organization.id,
        organizationUnitId: s.root.id,
        deliveryMethod: BundleDeliveryMethod.EMAIL,
      });
      const invoice = await readyTimesheet(s, [
        await entryAt(s, '2026-07-05T09:00:00.000Z'),
      ]);

      await expect(send(s)).rejects.toThrow('No accounting email address');

      const stored = await db.query.invoices.findFirst({
        where: { id: invoice.id },
      });
      expect(stored?.paidAt).toBeNull();
      expect(await deliveriesOf(s)).toEqual([]);
    });

    it('sends a bundle with hours without a contract only once that is confirmed', async () => {
      const s = await setup();
      await configure(s);
      const invoice = await readyTimesheet(s, [
        await entryAt(s, '2026-07-05T09:00:00.000Z'),
      ]);
      withoutActiveCover = new Set([invoice.id]);

      expect((await emailService.preview(request(s))).issues).toEqual([
        BundleDeliveryIssue.NO_CONTRACT,
      ]);
      await expect(send(s)).rejects.toBeInstanceOf(ConflictGraphQLError);
      expect(await deliveriesOf(s)).toEqual([]);

      const delivery = await send(s, [BundleDeliveryIssue.NO_CONTRACT]);
      expect(delivery.issues).toEqual([BundleDeliveryIssue.NO_CONTRACT]);
    });

    it('flags a bundle whose year is over the yearly allowance', async () => {
      const s = await setup();
      await configure(s);
      await readyTimesheet(s, [await entryAt(s, '2026-07-05T09:00:00.000Z')]);
      await db.insert(schema.reimbursementManualBaselines).values({
        organizationId: s.organization.id,
        volunteerId: s.volunteer.id,
        reimbursementTypeKey: s.reimbursementType.key,
        year: 2026,
        amountCents: s.reimbursementType.yearlyLimitCents,
      });

      expect((await emailService.preview(request(s))).issues).toEqual([
        BundleDeliveryIssue.OVER_LIMIT,
      ]);
    });

    it('asks again before sending the same timesheets a second time', async () => {
      const s = await setup();
      await configure(s);
      await insertContract(s, JULY);
      await readyTimesheet(s, [await entryAt(s, '2026-07-05T09:00:00.000Z')]);
      await send(s);

      await expect(send(s)).rejects.toBeInstanceOf(ConflictGraphQLError);
      const again = await send(s, [BundleDeliveryIssue.ALREADY_SENT]);

      expect(again.issues).toEqual([BundleDeliveryIssue.ALREADY_SENT]);
      expect(await deliveriesOf(s)).toHaveLength(2);
    });

    it('records a sent email even when marking the invoices paid fails', async () => {
      const s = await setup();
      await configure(s);
      await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [
        await entryAt(s, '2026-07-05T09:00:00.000Z'),
      ]);
      await send(s);
      const markPaid = spyOn(
        ReimbursementRateService.prototype,
        'markInvoicesPaid',
      ).mockRejectedValue(new Error('paid stamp failed'));

      try {
        await outbox.drain();
      } finally {
        markPaid.mockRestore();
      }

      const [delivery] = await deliveriesOf(s);
      expect(delivery?.emailStatus).toBe(EmailDeliveryStatus.SENT);
      expect(await isPaid(invoice.id)).toBe(false);
    });

    it('leaves a bundle whose email failed unpaid, says so, and lets it go out again without asking', async () => {
      const s = await setup();
      await configure(s);
      await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [
        await entryAt(s, '2026-07-05T09:00:00.000Z'),
      ]);
      await send(s);
      // A timeout: the provider may have taken it, so it is not retried.
      sendResult = {
        ok: false,
        retryable: true,
        error: new Error('timed out'),
      };
      await outbox.drain();

      const latest = await new BundleDeliveryLogService(
        db,
      ).findLatestEmailDeliveries([invoice.id]);
      expect(latest.get(invoice.id)?.status).toBe(EmailDeliveryStatus.FAILED);
      expect(await isPaid(invoice.id)).toBe(false);
      expect((await emailService.preview(request(s))).issues).toEqual([]);

      const again = await send(s);
      expect(again.issues).toEqual([]);
    });

    it('refuses to email a bundle for a unit that downloads', async () => {
      const s = await setup();
      await settingsService.update(
        s.root.id,
        { recipientEmail: RECIPIENT },
        s.downloader.id,
      );
      await readyTimesheet(s, [await entryAt(s, '2026-07-05T09:00:00.000Z')]);

      await expect(send(s)).rejects.toThrow('does not send bundles by email');
      expect(await deliveriesOf(s)).toEqual([]);
    });

    it('keeps the outcome in the log after the outbox purges the email', async () => {
      const s = await setup();
      await configure(s);
      await insertContract(s, JULY);
      await readyTimesheet(s, [await entryAt(s, '2026-07-05T09:00:00.000Z')]);
      const delivery = await send(s);
      await outbox.drain();
      await db
        .update(schema.emailOutbox)
        .set({ updatedAt: new Date(Date.now() - 60 * 86_400_000) })
        .where(eq(schema.emailOutbox.id, delivery.emailOutboxId ?? ''));

      await outbox.purgeSettledEmails();

      const [purged] = await db
        .select({ id: schema.emailOutbox.id })
        .from(schema.emailOutbox)
        .where(eq(schema.emailOutbox.id, delivery.emailOutboxId ?? ''));
      expect(purged).toBeUndefined();
      const [logged] = await new BundleDeliveryLogService(db).list(s.root.id);
      expect(logged?.emailStatus).toBe(EmailDeliveryStatus.SENT);
      expect((await emailService.preview(request(s))).issues).toEqual([
        BundleDeliveryIssue.ALREADY_SENT,
      ]);
    });

    it('sends a bundle once when two sends race', async () => {
      const s = await setup();
      await configure(s);
      await insertContract(s, JULY);
      await readyTimesheet(s, [await entryAt(s, '2026-07-05T09:00:00.000Z')]);

      const results = await Promise.allSettled([send(s), send(s)]);

      expect(results.map((result) => result.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
      const rejected = results.find((result) => result.status === 'rejected');
      expect(
        rejected?.status === 'rejected' ? rejected.reason : undefined,
      ).toBeInstanceOf(ConflictGraphQLError);
      expect(await deliveriesOf(s)).toHaveLength(1);
    });

    it('refuses a bundle with more timesheets than an email can carry', async () => {
      const s = await setup();
      await configure(s);
      for (let day = 1; day <= 11; day++) {
        await readyTimesheet(s, [
          await entryAt(
            s,
            `2026-07-${String(day).padStart(2, '0')}T09:00:00.000Z`,
          ),
        ]);
      }

      expect((await emailService.preview(request(s))).fitsInEmail).toBe(false);
      await expect(send(s)).rejects.toThrow('too many documents');
      expect(await deliveriesOf(s)).toEqual([]);
    });

    it('logs a download as a delivery as well', async () => {
      const s = await setup();
      await insertContract(s, JULY);
      const invoice = await readyTimesheet(s, [
        await entryAt(s, '2026-07-05T09:00:00.000Z'),
      ]);

      await download(s);

      const [delivery] = await deliveriesOf(s);
      expect(delivery).toMatchObject({
        method: BundleDeliveryMethod.DOWNLOAD,
        invoiceIds: [invoice.id],
        recipientEmail: null,
        deliveredByUserId: s.downloader.id,
      });
    });
  });

  describe('delivery settings inheritance (VOLI-1766)', () => {
    it('resolves each field on its own up the unit chain', async () => {
      const s = await setup();
      const child = await createUnit(db, {
        organizationId: s.organization.id,
        typeId: s.type.id,
        name: 'child',
        parentId: s.root.id,
      });
      await settingsService.update(
        s.root.id,
        { recipientEmail: 'root@example.org' },
        s.downloader.id,
      );
      await settingsService.update(
        child.id,
        { emailSubject: 'Child {volunteer}' },
        s.downloader.id,
      );

      const resolved = await settingsService.resolve(child.id, 'de');

      expect(resolved).toMatchObject({
        deliveryMethod: BundleDeliveryMethod.DOWNLOAD,
        deliveryMethodSource: { kind: AccountingSettingSourceKind.DEFAULT },
        recipientEmail: 'root@example.org',
        recipientEmailSource: {
          kind: AccountingSettingSourceKind.INHERITED,
          sourceName: 'root',
        },
        emailSubject: 'Child {volunteer}',
        emailSubjectSource: { kind: AccountingSettingSourceKind.OWN },
        ownRecipientEmail: null,
        inheritedRecipientEmail: 'root@example.org',
        inheritedEmailSubject: resolved.defaultEmailSubject,
      });
    });

    it('inherits again once the own value is cleared', async () => {
      const s = await setup();
      await settingsService.update(
        s.root.id,
        { recipientEmail: 'root@example.org' },
        s.downloader.id,
      );
      await settingsService.update(
        s.root.id,
        { recipientEmail: '  ' },
        s.downloader.id,
      );

      const resolved = await settingsService.resolve(s.root.id, 'en');
      expect(resolved.recipientEmail).toBeNull();
      expect(resolved.emailSubject).toBe(resolved.defaultEmailSubject);
    });

    it('keeps an intentionally empty value instead of inheriting', async () => {
      const s = await setup();
      await settingsService.update(
        s.root.id,
        {
          recipientEmail: 'root@example.org',
          emailSubject: 'Root {volunteer}',
        },
        s.downloader.id,
      );
      await settingsService.update(
        s.root.id,
        { recipientEmail: '', emailSubject: '' },
        s.downloader.id,
      );

      const resolved = await settingsService.resolve(s.root.id, 'en');
      expect(resolved.recipientEmail).toBe('');
      expect(resolved.recipientEmailSource).toEqual({
        kind: AccountingSettingSourceKind.OWN,
        sourceName: null,
      });
      expect(resolved.emailSubject).toBe('');
      expect(resolved.emailSubjectSource).toEqual({
        kind: AccountingSettingSourceKind.OWN,
        sourceName: null,
      });
    });

    it('rejects a recipient that is not an email address', async () => {
      const s = await setup();
      await expect(
        settingsService.update(
          s.root.id,
          { recipientEmail: 'nope' },
          s.downloader.id,
        ),
      ).rejects.toThrow('not an email address');
    });

    it('refuses email delivery when no address resolves up the chain', async () => {
      const s = await setup();
      await expect(
        settingsService.update(
          s.root.id,
          { deliveryMethod: BundleDeliveryMethod.EMAIL },
          s.downloader.id,
        ),
      ).rejects.toThrow('needs an accounting email address');

      await settingsService.update(
        s.root.id,
        {
          deliveryMethod: BundleDeliveryMethod.EMAIL,
          recipientEmail: 'root@example.org',
        },
        s.downloader.id,
      );
      await expect(
        settingsService.update(
          s.root.id,
          { recipientEmail: null },
          s.downloader.id,
        ),
      ).rejects.toThrow('needs an accounting email address');
    });

    it('rejects an unknown subject placeholder', async () => {
      const s = await setup();
      await expect(
        settingsService.update(
          s.root.id,
          { emailSubject: 'Abrechnung {iban}' },
          s.downloader.id,
        ),
      ).rejects.toThrow('unknown placeholder');
    });
  });
});
