import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../database/database.module';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as schema from '../database/schema';
import { ExportTable } from './enums';
import {
  DEFAULT_EXPORT_LOG_PAGE_SIZE,
  MAX_EXPORT_LOG_PAGE_SIZE,
} from './export.constants';
import type { ExportLogEntity } from './schemas/export-log.schema';

export interface RecordExportInput {
  organizationUnitId: string;
  actorUserId: string;
  tableKind: ExportTable;
  columns: string[];
  includedTechnicalIds: boolean;
  rowCount: number;
  subjectUserIds: string[];
}

export interface ListExportLogsOptions {
  tableKind?: ExportTable;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ExportLogService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async recordExport(input: RecordExportInput): Promise<ExportLogEntity> {
    const [row] = await this.db
      .insert(schema.exportLogs)
      .values(input)
      .returning();
    if (!row) {
      throw new Error('Failed to record export');
    }
    return row;
  }

  async listExportLogs(
    organizationUnitId: string,
    options: ListExportLogsOptions = {},
  ): Promise<ExportLogEntity[]> {
    const limit = Math.min(
      Math.max(options.limit ?? DEFAULT_EXPORT_LOG_PAGE_SIZE, 1),
      MAX_EXPORT_LOG_PAGE_SIZE,
    );
    const offset = Math.max(options.offset ?? 0, 0);

    return this.db.query.exportLogs.findMany({
      where: {
        organizationUnitId,
        ...(options.tableKind ? { tableKind: options.tableKind } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      limit,
      offset,
    });
  }
}
