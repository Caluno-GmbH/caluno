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
  type RowData,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import { type DataTableFeatures, dataTableFeatures } from './features';
import { activeDir, ariaSort } from './table-sort';

interface DataTableProps<TData extends RowData> {
  // Table options fix cell TValue to unknown; column defs stay typed per-column.
  columns: ColumnDef<DataTableFeatures, TData, unknown>[];
  data: TData[];
  pageCount: number;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  emptyMessage: string;
  getRowClassName?: (row: TData) => string | undefined;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  pageCount,
  sorting,
  onSortingChange,
  emptyMessage,
  getRowClassName,
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: { sorting },
    onSortingChange,
    manualSorting: true,
    manualPagination: true,
    // Keep a column always sorted: without this, clicking the active header
    // cycles to "no sort" and the sort silently resets instead of reversing.
    enableSortingRemoval: false,
    pageCount,
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const dir = activeDir(header.column.getIsSorted());
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort(dir)}
                    className={cn(
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
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={getRowClassName?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      // Cells wrap by default so a long value cannot force the
                      // table wider than its container; a column can opt out via
                      // meta.cellClassName (e.g. the actions column).
                      'whitespace-normal',
                      cell.column.columnDef.meta?.cellClassName,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
