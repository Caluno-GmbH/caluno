import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import AdmZip from 'adm-zip';
import { PDFDocument } from 'pdf-lib';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import { FileService } from '../../storage/services/file.service';
import {
  BundleDeliveryIssue,
  BundleDeliveryMethod,
  InvoiceStatus,
  ReimbursementTypeKey,
} from '../enums';
import type { ContractEntity } from '../schemas/contract.schema';
import { billingYearOf } from '../utils/billing-period';
import { ContractCover, type CoverageTarget } from '../utils/contract-coverage';
import { BundleDeliveryLogService } from './bundle-delivery-log.service';
import { ContractService } from './contract.service';
import { InvoiceService } from './invoice.service';
import { ReimbursementRateService } from './reimbursement-rate.service';

interface BuiltBundle {
  buffer: Buffer;
  zipName: string;
}

export interface BundleScope {
  volunteerId: string;
  reimbursementTypeKey: ReimbursementTypeKey;
  organizationUnitId: string;
}

export interface BundleDocument {
  invoiceId: string;
  filename: string;
  content: Buffer;
}

export type ReadyInvoice = Awaited<
  ReturnType<BundleDownloadService['loadReadyInvoices']>
>[number];

/**
 * Assembles the ready-to-go documents for a volunteer + reimbursement type
 * (for a ZIP download, or for `BundleEmailService` to send) and records the
 * download (audit row + marking
 * the READY invoices as paid) once the bundle is built.
 *
 * The bundle holds one PDF per READY timesheet of that type the board shows
 * (all of them without a list), paid or not: the timesheet's pages, then the
 * pages of the signed agreements (ACTIVE contracts) that cover its hours, the
 * newest covering contract per time entry, each once, oldest period first
 * (VOLI-1586, VOLI-1551). Documents are resolved to their stored PDF bytes
 * via server-side GetObject (private object storage), merged and zipped on
 * the fly — nothing is persisted, so repeated downloads don't accumulate
 * artifacts (VOLI-1216).
 */
@Injectable()
export class BundleDownloadService {
  private readonly logger = new Logger(BundleDownloadService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly fileService: FileService,
    private readonly reimbursementRateService: ReimbursementRateService,
    private readonly contractService: ContractService,
    private readonly invoiceService: InvoiceService,
    private readonly bundleDeliveryLogService: BundleDeliveryLogService,
  ) {}

  async buildAndRecord(
    organizationId: string,
    organizationUnitId: string,
    volunteerId: string,
    reimbursementTypeKey: ReimbursementTypeKey,
    userId: string,
    invoiceIds?: string[],
  ): Promise<BuiltBundle> {
    const scope = { volunteerId, reimbursementTypeKey, organizationUnitId };
    const invoices = await this.loadReadyInvoices(scope, invoiceIds);
    if (invoices.length === 0) {
      throw new BadRequestException(
        'No ready documents to download for this volunteer and reimbursement type.',
      );
    }

    // The issues only annotate the log row; they never block a download.
    const [documents, issues] = await Promise.all([
      this.assembleDocuments(invoices, scope, userId),
      this.findIssues(organizationId, scope, invoices).catch(
        (error: unknown) => {
          this.logger.warn(
            `Bundle download: issues for the log could not be found: ${reasonOf(error)}`,
          );
          return [];
        },
      ),
    ]);

    // `noSort` keeps the timesheets in the order they were added in.
    const zip = new AdmZip(undefined, { noSort: true });
    for (const document of documents) {
      zip.addFile(document.filename, document.content);
    }
    const buffer = zip.toBuffer();

    // Record the download (audit row + mark the READY invoices as paid). Only
    // once the ZIP is built, and `loadTimesheetPdf` throws when a timesheet's
    // file cannot be resolved, fetched or read, so nothing is marked paid for a
    // ZIP that lacks one of its timesheets. Timesheets paid by an earlier download keep
    // their stamp; the audit row still records this one.
    await this.db.transaction(async (tx) => {
      await this.reimbursementRateService.recordBundleDownload(
        volunteerId,
        reimbursementTypeKey,
        userId,
        invoices.filter((i) => !i.paidAt).map((i) => i.id),
        tx,
      );
      await this.bundleDeliveryLogService.record(
        {
          ...scope,
          method: BundleDeliveryMethod.DOWNLOAD,
          invoiceIds: invoices.map((i) => i.id),
          issues,
          deliveredByUserId: userId,
        },
        tx,
      );
    });

    return {
      buffer,
      zipName: `Abrechnung-${volunteerId.slice(0, 8)}.zip`,
    };
  }

  /**
   * Every READY timesheet, paid or not: there is no payment integration, so
   * handing a bundle over is taken as the payment and a repeated one hands
   * over the same documents again. The board names the timesheets it shows,
   * so the bundle holds what is on screen; they are still matched in this
   * volunteer, type and unit and must be READY.
   */
  async loadReadyInvoices(scope: BundleScope, invoiceIds?: string[]) {
    return this.db.query.invoices.findMany({
      where: {
        ...scope,
        invoiceStatus: InvoiceStatus.READY,
        ...(invoiceIds ? { id: { in: invoiceIds } } : {}),
      },
      with: {
        invoiceTimeEntries: {
          where: { released: false },
          with: { timeEntry: true },
        },
      },
    });
  }

  async assembleDocuments(
    invoices: ReadyInvoice[],
    scope: BundleScope,
    userId: string,
  ): Promise<BundleDocument[]> {
    const contractsByInvoice = await this.findCoveringContracts(
      invoices,
      scope,
    );

    // A READY timesheet without a PDF had its rendering fail when it was
    // signed; it is rendered now rather than left out of the bundle.
    const timesheets: (ReadyInvoice & { fileId: string })[] = [];
    for (const invoice of invoices) {
      const fileId =
        invoice.fileId ?? (await this.renderMissingTimesheet(invoice, userId));
      timesheets.push({ ...invoice, fileId });
    }

    // A contract that covers several timesheets is fetched once and appended
    // to each of them.
    const contractPdfs = new Map<string, Promise<PDFDocument | null>>();
    const contractPdf = (contract: ContractEntity) => {
      let pdf = contractPdfs.get(contract.id);
      if (!pdf) {
        pdf = this.loadContractPdf(contract, userId);
        contractPdfs.set(contract.id, pdf);
      }
      return pdf;
    };

    const documents: BundleDocument[] = [];
    for (const invoice of timesheets) {
      const filename = `Stundennachweis-${invoice.id.slice(0, 8)}-${invoice.id.slice(8, 12)}.pdf`;
      const parts: PDFDocument[] = [
        await this.loadTimesheetPdf(filename, invoice),
      ];
      for (const contract of contractsByInvoice.get(invoice.id) ?? []) {
        const pdf = await contractPdf(contract);
        if (pdf) parts.push(pdf);
      }
      documents.push({
        invoiceId: invoice.id,
        filename,
        content: await mergePdfs(parts),
      });
    }
    return documents;
  }

  /**
   * What makes a bundle faulty, matching the board's flags: an hour without
   * an ACTIVE contract right now, or a billing year of its timesheets over
   * the yearly allowance. `checkAlreadySent` adds a repeated email send.
   */
  async findIssues(
    organizationId: string,
    scope: BundleScope,
    invoices: ReadyInvoice[],
    options: { checkAlreadySent?: boolean } = {},
  ): Promise<BundleDeliveryIssue[]> {
    const invoiceIds = invoices.map((invoice) => invoice.id);
    const years = [
      ...new Set(invoices.map((invoice) => billingYearOf(invoice.periodStart))),
    ];
    const [withoutCover, usages, alreadySent] = await Promise.all([
      this.invoiceService.findInvoiceIdsWithoutActiveCover(invoiceIds),
      Promise.all(
        years.map((year) =>
          this.reimbursementRateService.getYearlyUsage(
            organizationId,
            scope.volunteerId,
            scope.reimbursementTypeKey,
            year,
          ),
        ),
      ),
      options.checkAlreadySent
        ? this.bundleDeliveryLogService.hasEmailDelivery(
            scope.organizationUnitId,
            invoiceIds,
          )
        : Promise.resolve(false),
    ]);

    const issues: BundleDeliveryIssue[] = [];
    if (withoutCover.size > 0) issues.push(BundleDeliveryIssue.NO_CONTRACT);
    if (usages.some((usage) => usage.usedCents > usage.limitCents)) {
      issues.push(BundleDeliveryIssue.OVER_LIMIT);
    }
    if (alreadySent) issues.push(BundleDeliveryIssue.ALREADY_SENT);
    return issues;
  }

  /**
   * Per timesheet, the ACTIVE contracts that cover its hours: the newest
   * covering contract per time entry, each contract once, oldest period
   * first. Hours no contract covers add nothing, so a non-compliant timesheet
   * still downloads on its own.
   *
   * Every entry is matched in the bundle's own volunteer, reimbursement type
   * and unit, not in whatever the entry row says today: a coordinator can edit
   * a claimed entry's type, and that must not pull another type's contract
   * into this bundle.
   */
  private async findCoveringContracts(
    invoices: {
      id: string;
      invoiceTimeEntries: {
        timeEntry: { id: string; startedAt: Date } | null;
      }[];
    }[],
    scope: {
      volunteerId: string;
      reimbursementTypeKey: ReimbursementTypeKey;
      organizationUnitId: string;
    },
  ): Promise<Map<string, ContractEntity[]>> {
    const entriesOf = (invoice: (typeof invoices)[number]) =>
      invoice.invoiceTimeEntries.flatMap((claim) =>
        claim.timeEntry ? [claim.timeEntry] : [],
      );
    // One lookup for every timesheet; time entry ids are unique keys.
    const targets: CoverageTarget[] = invoices.flatMap((invoice) =>
      entriesOf(invoice).map((entry) => ({
        key: entry.id,
        ...scope,
        at: entry.startedAt,
      })),
    );
    const coverByEntry = await this.contractService.findCoveringContracts(
      targets,
      ContractCover.ACTIVE,
    );

    const contractsByInvoice = new Map<string, ContractEntity[]>();
    for (const invoice of invoices) {
      const contractsById = new Map<string, ContractEntity>();
      for (const entry of entriesOf(invoice)) {
        const newest = coverByEntry.get(entry.id)?.[0];
        if (newest) contractsById.set(newest.id, newest);
      }
      contractsByInvoice.set(
        invoice.id,
        [...contractsById.values()].sort(
          (a, b) =>
            a.periodStart.getTime() - b.periodStart.getTime() ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        ),
      );
    }
    return contractsByInvoice;
  }

  /**
   * Renders the PDF a READY timesheet is missing. When that fails again the
   * download fails as well: a ZIP without the timesheet would mark it paid.
   */
  private async renderMissingTimesheet(
    invoice: { id: string },
    userId: string,
  ): Promise<string> {
    this.logger.warn(
      `Bundle download: timesheet ${invoice.id} is READY without a PDF, rendering it now`,
    );
    const fileId = await this.invoiceService.ensurePdf(invoice.id, userId);
    if (!fileId) {
      throw new InternalServerErrorException(
        `The timesheet ${invoice.id} has no PDF and it could not be generated, so the bundle was not built and nothing was marked as paid.`,
      );
    }
    return fileId;
  }

  /**
   * A timesheet is marked paid once the ZIP is built, so a ZIP without it
   * would lose it: when its file cannot be resolved, fetched or read, the
   * whole download fails.
   */
  private async loadTimesheetPdf(
    name: string,
    invoice: { fileId: string },
  ): Promise<PDFDocument> {
    let bytes: Buffer;
    try {
      bytes = await this.fileService.getUploadedFileBytes(invoice.fileId);
    } catch (error) {
      throw new InternalServerErrorException(
        `The document ${name} could not be fetched, so the bundle was not built and nothing was marked as paid. Please try again. (${reasonOf(error)})`,
      );
    }
    try {
      return await PDFDocument.load(bytes);
    } catch (error) {
      throw new InternalServerErrorException(
        `The document ${name} could not be read as a PDF, so the bundle was not built and nothing was marked as paid. (${reasonOf(error)})`,
      );
    }
  }

  /**
   * A contract only accompanies the timesheets: when it has no PDF, one is
   * rendered; when that fails or its file cannot be fetched or read, the
   * timesheets go out without it and a warning is logged.
   */
  private async loadContractPdf(
    contract: ContractEntity,
    userId: string,
  ): Promise<PDFDocument | null> {
    const fileId =
      contract.fileId ??
      (await this.contractService
        .ensurePdf(contract.id, userId)
        .catch((error: unknown) => {
          this.logger.warn(
            `Bundle download: rendering contract ${contract.id} failed: ${reasonOf(error)}`,
          );
          return null;
        }));
    if (!fileId) {
      this.logger.warn(
        `Bundle download: leaving out contract ${contract.id}, it has no PDF`,
      );
      return null;
    }
    try {
      const bytes = await this.fileService.getUploadedFileBytes(fileId);
      return await PDFDocument.load(bytes);
    } catch (error) {
      this.logger.warn(
        `Bundle download: leaving out contract ${contract.id} (${fileId}): ${reasonOf(error)}`,
      );
      return null;
    }
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** One PDF holding every page of `parts`, in order. */
async function mergePdfs(parts: PDFDocument[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const part of parts) {
    const pages = await merged.copyPages(part, part.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return Buffer.from(await merged.save());
}
