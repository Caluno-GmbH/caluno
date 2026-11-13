import type { ExportRowsInput, ExportTable } from '../../generated/base-types';
import type {
  ExportColumnsQuery,
  ExportLogsQuery,
  ExportTimesheetsCsvMutation,
} from '../../generated/graphql';
import { BaseRepository } from '../base/base.repository';

export type ExportFileResult =
  ExportTimesheetsCsvMutation['exportTimesheetsCsv'];
export type ExportColumnItem = ExportColumnsQuery['exportColumns'][number];
export type RawExportLogEntry = ExportLogsQuery['exportLogs'][number];

/** The selected table plus the rows/columns customization. */
export type ExportRequest = ExportRowsInput & { tableKind: ExportTable };

export interface ExportLogQuery {
  tableKind?: ExportTable;
  limit?: number;
  offset?: number;
}

export class ExportRepository extends BaseRepository {
  async exportRows(input: ExportRequest): Promise<ExportFileResult> {
    const { tableKind, ...rows } = input;

    switch (tableKind) {
      case 'TIMESHEETS': {
        const data = await this.sdk.ExportTimesheetsCsv({ input: rows });
        return data.exportTimesheetsCsv;
      }
      case 'SHIFTS': {
        const data = await this.sdk.ExportShiftsCsv({ input: rows });
        return data.exportShiftsCsv;
      }
      case 'USERS': {
        const data = await this.sdk.ExportUsersCsv({ input: rows });
        return data.exportUsersCsv;
      }
      default:
        throw new Error(`Unsupported export table: ${String(tableKind)}`);
    }
  }

  async listExportColumns(tableKind: ExportTable): Promise<ExportColumnItem[]> {
    const data = await this.sdk.ExportColumns({ tableKind });
    return data.exportColumns;
  }

  async listExportLogs(
    query: ExportLogQuery = {},
  ): Promise<RawExportLogEntry[]> {
    const data = await this.sdk.ExportLogs(query);
    return data.exportLogs;
  }
}
