import { Inject, Injectable, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import { BadRequestGraphQLError } from '../../graphql/errors';
import { FileService } from '../../storage/services/file.service';
import { InvoiceStatus } from '../enums';
import type { ContractEntity } from '../schemas/contract.schema';
import {
  ContractCover,
  type CoverableTimeEntry,
  coverageTargetsForTimeEntries,
} from '../utils/contract-coverage';
import { ContractService } from './contract.service';
import { ReimbursementRateService } from './reimbursement-rate.service';

interface BundleEntry {
  name: string;
  fileId: string;
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
 * The bundle contains the signed agreement (contract) plus every ready
 * (unpaid, READY) timesheet for that type. Documents are resolved to their
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
  ): Promise<BuiltBundle> {
    const invoices = await this.db.query.invoices.findMany({
      where: {
        volunteerId,
        reimbursementTypeId,
        organizationUnitId,
        invoiceStatus: InvoiceStatus.READY,
        paidAt: { isNull: true },
      },
      with: {
        invoiceTimeEntries: {
          where: { released: false },
          with: { timeEntry: true },
        },
      },
    });

    const contracts = await this.findCoveringContracts(invoices);

    const entries: BundleEntry[] = [];
    for (const contract of contracts) {
      if (!contract.fileId) continue;
      entries.push({
        name: `Vereinbarung-${contract.id.slice(0, 8)}-${contract.id.slice(8, 12)}.pdf`,
        fileId: contract.fileId,
      });
    }
    for (const invoice of invoices) {
      if (!invoice.fileId) continue;
      entries.push({
        name: `Stundennachweis-${invoice.id.slice(0, 8)}-${invoice.id.slice(8, 12)}.pdf`,
        fileId: invoice.fileId,
      });
    }

    if (entries.length === 0) {
      throw new BadRequestGraphQLError(
        'No ready documents to download for this volunteer and reimbursement type.',
      );
    }

    const buffer = await this.zipEntries(entries);

    // Record the download (audit row + mark the READY invoices as paid). Only
    // once the ZIP is built, so a failed render never marks anything paid.
    if (invoices.length > 0) {
      await this.reimbursementRateService.recordBundleDownload(
        volunteerId,
        reimbursementTypeId,
        userId,
        invoices.map((i) => i.id),
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
   */
  private async findCoveringContracts(
    invoices: {
      invoiceTimeEntries: { timeEntry: CoverableTimeEntry | null }[];
    }[],
  ): Promise<ContractEntity[]> {
    const timeEntries = invoices.flatMap((invoice) =>
      invoice.invoiceTimeEntries.flatMap((claim) =>
        claim.timeEntry ? [claim.timeEntry] : [],
      ),
    );
    const coverByEntry = await this.contractService.findCoveringContracts(
      coverageTargetsForTimeEntries(timeEntries),
      ContractCover.ACTIVE,
    );

    const contractsById = new Map<string, ContractEntity>();
    for (const entry of timeEntries) {
      const newest = coverByEntry.get(entry.id)?.[0];
      if (newest) contractsById.set(newest.id, newest);
    }
    return [...contractsById.values()].sort(
      (a, b) =>
        a.periodStart.getTime() - b.periodStart.getTime() ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  }

  private async zipEntries(entries: BundleEntry[]): Promise<Buffer> {
    const zip = new AdmZip();
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
        this.logger.warn(
          `Bundle download: skipping ${entry.name} (${entry.fileId}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return zip.toBuffer();
  }
}
