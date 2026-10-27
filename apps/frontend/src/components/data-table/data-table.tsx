'use client';

import {
  cn,
  Table,
  TableBody,
  TableCell,
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
  emptyMessage: string;
  getRowClassName?: (row: TData) => string | undefined;
  expansion?: DataTableExpansionProps<TData>;
}

interface DataTableClientProps<TData extends RowData> {
  mode: 'client';
  columns: ColumnDef<DataTableFeatures, TData, unknown>[];
  data: TData[];
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  emptyMessage: string;
  getRowClassName?: (row: TData) => string | undefined;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
}

type DataTableProps<TData extends RowData> =
  | DataTableServerProps<TData>
  | DataTableClientProps<TData>;

export function DataTable<TData extends RowData>(props: DataTableProps<TData>) {
  const { columns, data, emptyMessage, getRowClassName, onSortingChange } =
    props;
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
              return (
                <TableRow
                  key={row.id}
                  data-depth={row.depth}
                  className={getRowClassName?.(row.original)}
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
      </Table>
    </div>
  );
}
