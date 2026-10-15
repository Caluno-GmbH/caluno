import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import AdmZip from 'adm-zip';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import { FileService } from '../../storage/services/file.service';
import { InvoiceStatus } from '../enums';
import type { ContractEntity } from '../schemas/contract.schema';
import { ContractCover, type CoverageTarget } from '../utils/contract-coverage';
import { ContractService } from './contract.service';
import { ReimbursementRateService } from './reimbursement-rate.service';

interface BundleEntry {
  name: string;
  fileId: string;
  /**
   * Whether the download must fail when this file cannot be fetched. A
   * timesheet is marked paid once the ZIP is built, so a ZIP without it would
   * lose it; a contract only accompanies the timesheets.
   */
  required: boolean;
}

interface BuiltBundle {
  buffer: Buffer;
  zipName: string;
}

/**
 * Assembles the ready-to-go documents for a volunteer + reimbursement type
 * into a single downloadable ZIP and records the download (audit row + marking
 * the READY invoices as paid) once the bundle is built.
 *
 * The bundle contains the READY timesheets of that type the board shows (all of
 * them without a list), paid or not, plus
 * the signed agreements (ACTIVE contracts) that cover the hours on those
 * timesheets: the newest covering contract per time entry, each once, listed
 * ahead of the timesheets (VOLI-1586). Documents are resolved to their
 * stored PDF bytes (public object storage) and zipped on the fly — nothing is
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

    const contracts = await this.findCoveringContracts(invoices, scope);

    const entries: BundleEntry[] = [];
    for (const contract of contracts) {
      if (!contract.fileId) continue;
      entries.push({
        name: `Vereinbarung-${contract.id.slice(0, 8)}-${contract.id.slice(8, 12)}.pdf`,
        fileId: contract.fileId,
        required: false,
      });
    }
    for (const invoice of invoices) {
      if (!invoice.fileId) continue;
      entries.push({
        name: `Stundennachweis-${invoice.id.slice(0, 8)}-${invoice.id.slice(8, 12)}.pdf`,
        fileId: invoice.fileId,
        required: true,
      });
    }

    if (entries.length === 0) {
      throw new BadRequestException(
        'No ready documents to download for this volunteer and reimbursement type.',
      );
    }

    const buffer = await this.zipEntries(entries);

    // Record the download (audit row + mark the READY invoices as paid). Only
    // once the ZIP is built, and `zipEntries` throws when a timesheet's file
    // cannot be resolved or fetched, so nothing is marked paid for a ZIP that
    // lacks one of its timesheets. Timesheets paid by an earlier download keep
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
   * The ACTIVE contracts that cover the hours on these timesheets: the newest
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
      invoiceTimeEntries: {
        timeEntry: { id: string; startedAt: Date } | null;
      }[];
    }[],
    scope: {
      volunteerId: string;
      reimbursementTypeId: string;
      organizationUnitId: string;
    },
  ): Promise<ContractEntity[]> {
    const targets: CoverageTarget[] = invoices.flatMap((invoice) =>
      invoice.invoiceTimeEntries.flatMap((claim) =>
        claim.timeEntry
          ? [
              {
                key: claim.timeEntry.id,
                ...scope,
                at: claim.timeEntry.startedAt,
              },
            ]
          : [],
      ),
    );
    const coverByEntry = await this.contractService.findCoveringContracts(
      targets,
      ContractCover.ACTIVE,
    );

    const contractsById = new Map<string, ContractEntity>();
    for (const target of targets) {
      const newest = coverByEntry.get(target.key)?.[0];
      if (newest) contractsById.set(newest.id, newest);
    }
    return [...contractsById.values()].sort(
      (a, b) =>
        a.periodStart.getTime() - b.periodStart.getTime() ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  }

  private async zipEntries(entries: BundleEntry[]): Promise<Buffer> {
    // `noSort` keeps the order the entries were added in: contracts first.
    const zip = new AdmZip(undefined, { noSort: true });
    for (const entry of entries) {
      const url = await this.fileService.resolvePublicUrlForUploadedFile(
        entry.fileId,
      );
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${entry.name}: ${response.status}`);
        }
        zip.addFile(entry.name, Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (entry.required) {
          throw new InternalServerErrorException(
            `The document ${entry.name} could not be fetched, so the bundle was not built and nothing was marked as paid. Please try again. (${reason})`,
          );
        }
        this.logger.warn(
          `Bundle download: skipping ${entry.name} (${entry.fileId}): ${reason}`,
        );
      }
    }
    return zip.toBuffer();
  }
}
