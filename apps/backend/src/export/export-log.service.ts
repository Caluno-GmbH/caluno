import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../database/database.module';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as schema from '../database/schema';
import { ExportTable } from './enums';
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

@Injectable()
export class ExportLogService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async recordExport(
    input: RecordExportInput,
    tx?: Database,
  ): Promise<ExportLogEntity> {
    const conn = tx ?? this.db;
    const [row] = await conn
      .insert(schema.exportLogs)
      .values(input)
      .returning();
    return row;
  }

  async listExportLogs(
    organizationUnitId: string,
    tableKind?: ExportTable,
  ): Promise<ExportLogEntity[]> {
    const conditions = [
      eq(schema.exportLogs.organizationUnitId, organizationUnitId),
    ];
    if (tableKind !== undefined) {
      conditions.push(eq(schema.exportLogs.tableKind, tableKind));
    }
    return this.db
      .select()
      .from(schema.exportLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.exportLogs.occurredAt));
  }
}
