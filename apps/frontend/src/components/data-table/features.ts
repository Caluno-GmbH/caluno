import {
  columnVisibilityFeature,
  createExpandedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  metaHelper,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table';

/**
 * Shared feature set for app data tables.
 * Server mode uses manualSorting/manualPagination = true, so the registered
 * row models are bypassed. Client mode sets them to false and relies on the
 * row models below. Client-mode search filters `data` before it is passed in,
 * so the filtering features are not registered.
 *
 * sortFns must be registered for `sortFn: 'auto'` (the column default) —
 * TanStack Table v9 no longer bundles them. Auto resolves to alphanumeric /
 * text / datetime from sampled cell values; basic is always available.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
  },
  columnMeta: metaHelper<{
    headerClassName?: string;
    cellClassName?: string;
  }>(),
});

export type DataTableFeatures = typeof dataTableFeatures;
