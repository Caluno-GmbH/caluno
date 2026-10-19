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
  type RowData,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import { type DataTableFeatures, dataTableFeatures } from './features';
import { activeDir, ariaSort } from './table-sort';

interface DataTableServerProps<TData extends RowData> {
  mode?: 'server';
  columns: ColumnDef<DataTableFeatures, TData, unknown>[];
  data: TData[];
  pageCount: number;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  emptyMessage: string;
  getRowClassName?: (row: TData) => string | undefined;
}

interface DataTableClientProps<TData extends RowData> {
  mode: 'client';
  columns: ColumnDef<DataTableFeatures, TData, unknown>[];
  data: TData[];
  pageCount?: number;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  emptyMessage: string;
  getRowClassName?: (row: TData) => string | undefined;
  globalFilter?: string;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
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
    mode = 'server',
  } = props;

  const isClient = mode === 'client';

  const sorting = isClient
    ? ((props as DataTableClientProps<TData>).sorting ?? [])
    : (props as DataTableServerProps<TData>).sorting;

  const onSortingChange = isClient
    ? (props as DataTableClientProps<TData>).onSortingChange
    : (props as DataTableServerProps<TData>).onSortingChange;

  const pageCount = isClient
    ? undefined
    : (props as DataTableServerProps<TData>).pageCount;

  const globalFilter = isClient
    ? (props as DataTableClientProps<TData>).globalFilter
    : undefined;

  const pagination = isClient
    ? (props as DataTableClientProps<TData>).pagination
    : undefined;

  const onPaginationChange = isClient
    ? (props as DataTableClientProps<TData>).onPaginationChange
    : undefined;

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: {
      sorting,
      ...(globalFilter !== undefined ? { globalFilter } : {}),
      ...(pagination !== undefined ? { pagination } : {}),
    },
    ...(onSortingChange ? { onSortingChange } : {}),
    ...(onPaginationChange ? { onPaginationChange } : {}),
    manualSorting: !isClient,
    manualPagination: !isClient,
    manualFiltering: !isClient,
    enableSortingRemoval: false,
    ...(pageCount !== undefined ? { pageCount } : {}),
    ...(isClient ? { globalFilterFn: 'includesString' } : {}),
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <Table className="table-fixed">
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
