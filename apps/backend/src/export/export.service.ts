import { Inject, Injectable } from '@nestjs/common';
import { BadRequestGraphQLError } from '../graphql/errors';
import { OrganizationUnitDataService } from '../organization/organization-unit-data.service';
import { FilePurpose } from '../storage/enums';
import { FileService } from '../storage/services/file.service';
import type { ExportCollector } from './collectors/export-collector';
import { EXPORT_COLLECTORS } from './collectors/export-collector';
import { ExportTable } from './enums';
import {
  EXPORT_MIME_TYPE,
  MAX_EXPORT_COLUMNS,
  MAX_EXPORT_ROW_IDS,
} from './export.constants';
import { EXPORT_TIME_ZONE } from './export-csv.util';
import { ExportLogService } from './export-log.service';
import {
  type ExportColumnDefinition,
  resolveExportColumns,
  serializeExport,
} from './serializers/export-serializer';

export interface GenerateExportInput {
  organizationUnitId: string;
  actorUserId: string;
  rowIds: string[];
  columns: string[];
  includeTechnicalIds: boolean;
  includeSubUnits: boolean;
}

export interface GeneratedExport {
  filename: string;
  downloadUrl: string;
}

@Injectable()
export class ExportService {
  private readonly collectorsByTable: ReadonlyMap<ExportTable, ExportCollector>;

  constructor(
    @Inject(EXPORT_COLLECTORS) collectors: ExportCollector[],
    private readonly organizationUnitDataService: OrganizationUnitDataService,
    private readonly exportLogService: ExportLogService,
    private readonly fileService: FileService,
  ) {
    this.collectorsByTable = new Map(
      collectors.map((collector) => [collector.tableKind, collector]),
    );
  }

  getColumns(tableKind: ExportTable): ExportColumnDefinition[] {
    return [...this.getCollector(tableKind).columns];
  }

  async generateExport(
    tableKind: ExportTable,
    input: GenerateExportInput,
  ): Promise<GeneratedExport> {
    this.assertBounds(input);

    const collector = this.getCollector(tableKind);
    const selectedColumns = resolveExportColumns(
      collector.columns,
      input.columns,
    );

    const unitIds = input.includeSubUnits
      ? await this.organizationUnitDataService.listInclusiveDescendantUnitIds(
          input.organizationUnitId,
        )
      : [input.organizationUnitId];

    const collected = await collector.collect({
      organizationUnitId: input.organizationUnitId,
      unitIds,
      rowIds: input.rowIds,
    });

    const content = serializeExport({
      columns: selectedColumns,
      rows: collected.rows,
      includeTechnicalIds: input.includeTechnicalIds,
      technicalIdLabel: collector.technicalIdLabel,
    });

    const orgUnit = await this.organizationUnitDataService.findById(
      input.organizationUnitId,
    );
    const filename = `${tableKind.toLowerCase()}-${fileSafeSegment(
      orgUnit?.name,
    )}-export-${berlinStamp()}.csv`;

    const file = await this.fileService.saveGeneratedFile({
      organizationUnitId: input.organizationUnitId,
      filename,
      mimeType: EXPORT_MIME_TYPE,
      bytes: Buffer.from(content, 'utf8'),
      uploadedByUserId: input.actorUserId,
      purpose: FilePurpose.EXPORT,
    });

    await this.exportLogService.recordExport({
      organizationUnitId: input.organizationUnitId,
      actorUserId: input.actorUserId,
      tableKind,
      columns: selectedColumns.map((column) => column.id),
      includedTechnicalIds: input.includeTechnicalIds,
      rowCount: collected.rows.length,
      subjectUserIds: collected.subjectUserIds,
    });

    const { downloadUrl } = await this.fileService.presignDownload(
      input.actorUserId,
      file.id,
      input.organizationUnitId,
    );

    return { filename, downloadUrl };
  }

  private getCollector(tableKind: ExportTable): ExportCollector {
    const collector = this.collectorsByTable.get(tableKind);
    if (!collector) {
      throw new BadRequestGraphQLError(
        `Unsupported export table: ${tableKind}`,
      );
    }
    return collector;
  }

  private assertBounds(input: GenerateExportInput): void {
    if (input.rowIds.length > MAX_EXPORT_ROW_IDS) {
      throw new BadRequestGraphQLError(
        `An export can contain at most ${MAX_EXPORT_ROW_IDS} rows`,
      );
    }
    if (input.columns.length > MAX_EXPORT_COLUMNS) {
      throw new BadRequestGraphQLError(
        `An export can select at most ${MAX_EXPORT_COLUMNS} columns`,
      );
    }
  }
}

function fileSafeSegment(name: string | null | undefined): string {
  const segment = (name ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return segment || 'org';
}

function berlinStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: EXPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}`;
}
