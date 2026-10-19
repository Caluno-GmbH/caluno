import {
  columnVisibilityFeature,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table';

/** Shared feature set for app data tables (manual sort + pagination). */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  // Needed for row.getVisibleCells(); we do not hide columns today.
  columnVisibilityFeature,
  // Layout hooks so a table can pin column widths and opt a column out of the
  // default cell wrapping without forking the shared component.
  columnMeta: metaHelper<{
    headerClassName?: string;
    cellClassName?: string;
  }>(),
});

export type DataTableFeatures = typeof dataTableFeatures;
