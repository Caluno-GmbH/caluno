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
import { InvoiceStatus } from '../enums';
import type { ContractEntity } from '../schemas/contract.schema';
import { ContractCover, type CoverageTarget } from '../utils/contract-coverage';
import { ContractService } from './contract.service';
import { InvoiceService } from './invoice.service';
import { ReimbursementRateService } from './reimbursement-rate.service';

interface BuiltBundle {
  buffer: Buffer;
  zipName: string;
}

/**
 * Assembles the ready-to-go documents for a volunteer + reimbursement type
 * into a single downloadable ZIP and records the download (audit row + marking
 * the READY invoices as paid) once the bundle is built.
 *
 * The bundle holds one PDF per READY timesheet of that type the board shows
 * (all of them without a list), paid or not: the timesheet's pages, then the
 * pages of the signed agreements (ACTIVE contracts) that cover its hours, the
 * newest covering contract per time entry, each once, oldest period first
 * (VOLI-1586, VOLI-1551). Documents are resolved to their stored PDF bytes
 * (public object storage), merged and zipped on the fly — nothing is
 * persisted, so repeated downloads don't accumulate artifacts (VOLI-1216).
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
  ) {}

  async buildAndRecord(
    organizationUnitId: string,
    volunteerId: string,
    reimbursementTypeId: string,
    userId: string,
    invoiceIds?: string[],
  ): Promise<BuiltBundle> {
    const scope = { volunteerId, reimbursementTypeId, organizationUnitId };
    // Every READY timesheet, paid or not: there is no payment integration, so
    // a download is taken as the payment and a repeated one hands over the same
    // documents again. The board names the timesheets it shows, so the ZIP
    // holds what is on screen; they are still matched in this volunteer, type
    // and unit and must be READY.
    const invoices = await this.db.query.invoices.findMany({
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

    const contractsByInvoice = await this.findCoveringContracts(
      invoices,
      scope,
    );

    if (invoices.length === 0) {
      throw new BadRequestException(
        'No ready documents to download for this volunteer and reimbursement type.',
      );
    }

    // A READY timesheet without a PDF had its rendering fail when it was
    // signed; it is rendered now rather than left out of the bundle.
    const timesheets: ((typeof invoices)[number] & { fileId: string })[] = [];
    for (const invoice of invoices) {
      const fileId =
        invoice.fileId ?? (await this.renderMissingTimesheet(invoice, userId));
      timesheets.push({ ...invoice, fileId });
    }

    // A contract that covers several timesheets is fetched once and appended
    // to each of them.
    const contractPdfs = new Map<string, Promise<PDFDocument | null>>();
    const contractPdf = (contract: ContractEntity & { fileId: string }) => {
      let pdf = contractPdfs.get(contract.id);
      if (!pdf) {
        pdf = this.loadContractPdf(contract);
        contractPdfs.set(contract.id, pdf);
      }
      return pdf;
    };

    // `noSort` keeps the timesheets in the order they were added in.
    const zip = new AdmZip(undefined, { noSort: true });
    for (const invoice of timesheets) {
      const name = `Stundennachweis-${invoice.id.slice(0, 8)}-${invoice.id.slice(8, 12)}.pdf`;
      const parts: PDFDocument[] = [await this.loadTimesheetPdf(name, invoice)];
      for (const contract of contractsByInvoice.get(invoice.id) ?? []) {
        if (!contract.fileId) continue;
        const pdf = await contractPdf({ ...contract, fileId: contract.fileId });
        if (pdf) parts.push(pdf);
      }
      zip.addFile(name, await mergePdfs(parts));
    }
    const buffer = zip.toBuffer();

    // Record the download (audit row + mark the READY invoices as paid). Only
    // once the ZIP is built, and `loadTimesheetPdf` throws when a timesheet's
    // file cannot be resolved, fetched or read, so nothing is marked paid for a
    // ZIP that lacks one of its timesheets. Timesheets paid by an earlier download keep
    // their stamp; the audit row still records this one.
    if (invoices.length > 0) {
      await this.reimbursementRateService.recordBundleDownload(
        volunteerId,
        reimbursementTypeId,
        userId,
        invoices.filter((i) => !i.paidAt).map((i) => i.id),
      );
    }

    return {
      buffer,
      zipName: `Abrechnung-${volunteerId.slice(0, 8)}.zip`,
    };
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
      reimbursementTypeId: string;
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
    const url = await this.fileService.resolvePublicUrlForUploadedFile(
      invoice.fileId,
    );
    let bytes: ArrayBuffer;
    try {
      bytes = await fetchBytes(url);
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
   * A contract only accompanies the timesheets: when its file cannot be
   * fetched or read, the timesheets go out without it and a warning is logged.
   */
  private async loadContractPdf(
    contract: ContractEntity & { fileId: string },
  ): Promise<PDFDocument | null> {
    const url = await this.fileService.resolvePublicUrlForUploadedFile(
      contract.fileId,
    );
    try {
      return await PDFDocument.load(await fetchBytes(url));
    } catch (error) {
      this.logger.warn(
        `Bundle download: leaving out contract ${contract.id} (${contract.fileId}): ${reasonOf(error)}`,
      );
      return null;
    }
  }
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.arrayBuffer();
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
