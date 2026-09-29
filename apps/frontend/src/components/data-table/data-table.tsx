'use client';

import {
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
  getCoreRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { activeDir, ariaSort } from './table-sort';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount: number;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  emptyMessage: string;
  getRowClassName?: (row: TData) => string | undefined;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  sorting,
  onSortingChange,
  emptyMessage,
  getRowClassName,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
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
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const dir = activeDir(header.column.getIsSorted());
                return (
                  <TableHead key={header.id} aria-sort={ariaSort(dir)}>
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
                  <TableCell key={cell.id} className="whitespace-normal">
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
