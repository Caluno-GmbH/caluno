import {
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table';

/**
 * Shared feature set for app data tables.
 * Server mode uses manualSorting/manualPagination = true, so the registered
 * row models are bypassed. Client mode sets them to false and relies on the
 * row models below. Client-mode search filters `data` before it is passed in,
 * so the filtering features are not registered.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: metaHelper<{
    headerClassName?: string;
    cellClassName?: string;
  }>(),
});

export type DataTableFeatures = typeof dataTableFeatures;
