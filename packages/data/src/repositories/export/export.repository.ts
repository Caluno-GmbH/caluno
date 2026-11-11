import type { ExportTable, ExportTableInput } from '../../generated/base-types';
import type {
  ExportLogsQuery,
  ExportTableCsvMutation,
} from '../../generated/graphql';
import { BaseRepository } from '../base/base.repository';

export type RawExportLogEntry = ExportLogsQuery['exportLogs'][number];
export type ExportFileResult = ExportTableCsvMutation['exportTableCsv'];

export class ExportRepository extends BaseRepository {
  async exportTableCsv(
    input: ExportTableInput,
  ): Promise<ExportFileResult> {
    const data = await this.sdk.ExportTableCsv({ input });
    return data.exportTableCsv;
  }

  async listExportLogs(tableKind?: ExportTable): Promise<RawExportLogEntry[]> {
    const data = await this.sdk.ExportLogs({ tableKind });
    return data.exportLogs;
  }
}
