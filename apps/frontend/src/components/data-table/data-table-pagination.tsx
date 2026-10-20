'use client';

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryStates } from 'nuqs';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  pageParser,
  pageSizeParser,
} from './table-params';

interface DataTablePaginationProps {
  total: number;
  name: string;
}

export function DataTablePagination({ total, name }: DataTablePaginationProps) {
  const t = useTranslations('Pagination');
  const tDataTable = useTranslations('DataTable');
  const tCommon = useTranslations('Common');

  const [{ page, pageSize }, setParams] = useQueryStates(
    { page: pageParser, pageSize: pageSizeParser },
    { shallow: false },
  );

  const pageSizeNum = Number(pageSize ?? String(DEFAULT_PAGE_SIZE));
  const pageCount = Math.max(1, Math.ceil(total / pageSizeNum));
  const startItem = Math.min((page - 1) * pageSizeNum + 1, total);
  const endItem = Math.min(page * pageSizeNum, total);

  const handlePrev = () => {
    void setParams({ page: Math.max(1, page - 1) });
  };

  const handleNext = () => {
    void setParams({ page: Math.min(pageCount, page + 1) });
  };

  const handlePageSizeChange = (value: string) => {
    void setParams({ pageSize: value as '15' | '25' | '50' | '100', page: 1 });
  };

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        {t('showing', {
          start: startItem,
          end: endItem,
          total,
          name,
        })}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {tDataTable('rowsPerPage')}
          </span>
          <Select
            value={String(pageSizeNum)}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {t('pageOf', { current: page, total: pageCount })}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={page <= 1}
          >
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            {tCommon('previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={page >= pageCount}
          >
            {tCommon('next')}
            <ChevronRightIcon className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
