import type { Permission } from '../../auth/constants';
import type { ExportTable } from '../enums';
import type {
  ExportColumnDefinition,
  ExportRow,
} from '../serializers/export-serializer';

export interface ExportCollectorContext {
  /** The caller's header unit (`x-organization-unit-id`). */
  organizationUnitId: string;
  /**
   * Units whose rows may be exported: the header unit alone, or the header unit
   * plus every descendant when the caller asked to include sub-units. Always
   * scoped in SQL, never widened to siblings or ancestors.
   */
  unitIds: string[];
  /** The rows the caller selected. Empty exports a header-only file. */
  rowIds: string[];
}

export interface CollectedExport {
  rows: ExportRow[];
  /** Users whose data is in the file — recorded in the audit log. */
  subjectUserIds: string[];
}

/**
 * One exportable table. A collector owns everything that is table-specific:
 * the permission it needs, its columns, and how it turns ids into CSV cells.
 */
export interface ExportCollector {
  readonly tableKind: ExportTable;
  readonly requiredPermission: Permission;
  readonly technicalIdLabel: string;
  readonly columns: readonly ExportColumnDefinition[];
  collect(context: ExportCollectorContext): Promise<CollectedExport>;
}

/** DI token for the registered collectors (see ExportModule). */
export const EXPORT_COLLECTORS = Symbol('EXPORT_COLLECTORS');
