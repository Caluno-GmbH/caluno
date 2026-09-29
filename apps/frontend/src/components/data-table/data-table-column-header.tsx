'use client';

import { Button } from '@repo/ui';
import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { activeDir } from './table-sort';

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const t = useTranslations('DataTable');

  if (!column.getCanSort()) {
    return <span>{title}</span>;
  }

  const dir = activeDir(column.getIsSorted());

  const label =
    dir === 'asc'
      ? t('sortedAscending')
      : dir === 'desc'
        ? t('sortedDescending')
        : t('unsorted');

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8"
      onClick={column.getToggleSortingHandler()}
    >
      <span>{title}</span>
      {dir === 'asc' ? (
        <ArrowUp className="ml-2 size-3.5" />
      ) : dir === 'desc' ? (
        <ArrowDown className="ml-2 size-3.5" />
      ) : (
        <ArrowUpDown className="text-muted-foreground ml-2 size-3.5" />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
