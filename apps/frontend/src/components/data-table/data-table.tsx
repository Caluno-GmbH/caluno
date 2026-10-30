'use client';

import {
  cn,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui';
import {
  type ColumnDef,
  flexRender,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowData,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { type DataTableFeatures, dataTableFeatures } from './features';
import { activeDir, ariaSort } from './table-sort';

interface DataTableExpansionProps<TData> {
  /** Returns child rows for a parent, or undefined for leaf rows. */
  getSubRows: (row: TData, index?: number) => TData[] | undefined;
  /** Whether a row renders an expander. Defaults to "has sub-rows". */
  getRowCanExpand?: (row: TData) => boolean;
  /** Start with every expandable row open. Default false. */
  defaultAllExpanded?: boolean;
}

interface DataTableServerProps<TData extends RowData> {
  mode?: 'server';
  columns: ColumnDef<DataTableFeatures, TData, unknown>[];
  data: TData[];
  pageCount: number;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  emptyMessage: ReactNode;
  getRowClassName?: (row: TData) => string | undefined;
  /** When set, the whole row navigates to this href on click. */
  getRowHref?: (row: TData) => string | null | undefined;
  expansion?: DataTableExpansionProps<TData>;
  footerContent?: ReactNode;
}

interface DataTableClientProps<TData extends RowData> {
  mode: 'client';
  columns: ColumnDef<DataTableFeatures, TData, unknown>[];
  data: TData[];
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  emptyMessage: ReactNode;
  getRowClassName?: (row: TData) => string | undefined;
  /** When set, the whole row navigates to this href on click. */
  getRowHref?: (row: TData) => string | null | undefined;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  footerContent?: ReactNode;
}

type DataTableProps<TData extends RowData> =
  | DataTableServerProps<TData>
  | DataTableClientProps<TData>;

export function DataTable<TData extends RowData>(props: DataTableProps<TData>) {
  const {
    columns,
    data,
    emptyMessage,
    getRowClassName,
    getRowHref,
    onSortingChange,
  } = props;
  const footerContent =
    'footerContent' in props ? props.footerContent : undefined;
  const router = useRouter();
  const isClient = props.mode === 'client';
  const client = props.mode === 'client' ? props : undefined;
  const server = props.mode === 'client' ? undefined : props;

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: {
      sorting: props.sorting ?? [],
      ...(client?.pagination ? { pagination: client.pagination } : {}),
    },
    ...(server?.expansion?.defaultAllExpanded
      ? { initialState: { expanded: true } }
      : {}),
    ...(onSortingChange ? { onSortingChange } : {}),
    ...(client?.onPaginationChange
      ? { onPaginationChange: client.onPaginationChange }
      : {}),
    manualSorting: !isClient,
    manualPagination: !isClient,
    enableSortingRemoval: false,
    ...(server ? { pageCount: server.pageCount } : {}),
    ...(server?.expansion
      ? {
          getSubRows: (originalRow: TData, index: number) =>
            server.expansion?.getSubRows(originalRow, index),
          getRowCanExpand: (row: Row<DataTableFeatures, TData>) =>
            server.expansion?.getRowCanExpand
              ? server.expansion.getRowCanExpand(row.original)
              : (server.expansion?.getSubRows(row.original)?.length ?? 0) > 0,
        }
      : {}),
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted hover:bg-muted">
              {headerGroup.headers.map((header, index) => {
                const dir = activeDir(header.column.getIsSorted());
                const isLast = index === headerGroup.headers.length - 1;
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort(dir)}
                    className={cn(
                      'h-8 px-2 text-xs font-normal text-muted-foreground min-w-[120px]',
                      !isLast && 'border-r border-border',
                      header.column.columnDef.meta?.headerClassName,
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-muted-foreground h-24 text-center"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const cells = row.getVisibleCells();
              const href = getRowHref?.(row.original);
              return (
                <TableRow
                  key={row.id}
                  data-depth={row.depth}
                  className={cn(
                    getRowClassName?.(row.original),
                    href && 'cursor-pointer',
                  )}
                  onClick={
                    href
                      ? (event) => {
                          // Clicks inside portals (e.g. a row's delete dialog)
                          // bubble through the React tree but aren't in the row.
                          if (
                            !event.currentTarget.contains(event.target as Node)
                          ) {
                            return;
                          }
                          // Let inner links/buttons handle their own clicks.
                          if (
                            (event.target as HTMLElement).closest(
                              'a,button,input,select,textarea,[role="button"],[role="menuitem"]',
                            )
                          ) {
                            return;
                          }
                          router.push(href);
                        }
                      : undefined
                  }
                >
                  {cells.map((cell, index) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'whitespace-normal py-2 px-3',
                        index < cells.length - 1 && 'border-r border-border',
                        cell.column.columnDef.meta?.cellClassName,
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
        {footerContent && (
          <TableFooter>{footerContent}</TableFooter>
        )}
      </Table>
    </div>
  );
}
