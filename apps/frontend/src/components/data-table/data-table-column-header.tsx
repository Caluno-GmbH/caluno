'use client';

import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui';
import type { Column, RowData } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { DataTableFeatures } from './features';
import { activeDir } from './table-sort';

interface DataTableColumnHeaderProps<TData extends RowData, TValue> {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
}

function TruncatedLabel({ title }: { title: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: title change updates DOM text; re-run to recheck truncation
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollWidth > el.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [title]);

  const label = (
    <span ref={ref} className="truncate min-w-0 block">
      {title}
    </span>
  );

  if (!truncated) return label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const t = useTranslations('DataTable');

  if (!column.getCanSort()) {
    return (
      <span className="flex min-w-0 overflow-hidden text-xs font-normal text-muted-foreground">
        <TruncatedLabel title={title} />
      </span>
    );
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
      className="-ml-2 h-8 max-w-full overflow-hidden text-xs font-normal text-muted-foreground"
      onClick={column.getToggleSortingHandler()}
    >
      <TruncatedLabel title={title} />
      {dir === 'asc' ? (
        <ArrowUp className="ml-2 size-3.5 shrink-0" />
      ) : dir === 'desc' ? (
        <ArrowDown className="ml-2 size-3.5 shrink-0" />
      ) : (
        <ArrowUpDown className="text-muted-foreground ml-2 size-3.5 shrink-0" />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
