'use client';

import {
  BundleDeliveryMethod,
  EmailDeliveryStatus,
  type RawBundleDelivery,
} from '@repo/data';
import { useBundleDeliveries } from '@repo/data/react';
import {
  Badge,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui';
import { AlertCircleIcon, ChevronLeftIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { maskEmail } from '../lib/delivery-settings';
import { pauschaleForReimbursementTypeKey } from '../lib/reimbursement-type-mapping';
import { getPauschaleKey } from './doc-type-header';

const PAGE_SIZE = 50;

const STATUS_VARIANT: Record<
  EmailDeliveryStatus,
  'neutral' | 'success' | 'error'
> = {
  [EmailDeliveryStatus.Pending]: 'neutral',
  [EmailDeliveryStatus.Sending]: 'neutral',
  [EmailDeliveryStatus.Sent]: 'success',
  [EmailDeliveryStatus.Failed]: 'error',
  [EmailDeliveryStatus.Cancelled]: 'error',
};

export function BundleDeliveryLog({ orgUId }: { orgUId: string }) {
  const t = useTranslations('Accounting.deliveries');
  const [page, setPage] = useState(0);
  // One extra row tells whether a next page exists.
  const query = useBundleDeliveries(orgUId, PAGE_SIZE + 1, page * PAGE_SIZE);
  const rows = query.data?.slice(0, PAGE_SIZE) ?? [];
  const hasNext = (query.data?.length ?? 0) > PAGE_SIZE;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/admin/${orgUId}/accounting/reimbursements`}>
          <ChevronLeftIcon />
          {t('back')}
        </Link>
      </Button>

      {query.isError ? (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
          <AlertCircleIcon
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <p>{t('loadError')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tableHead.date')}</TableHead>
                <TableHead>{t('tableHead.volunteer')}</TableHead>
                <TableHead>{t('tableHead.type')}</TableHead>
                <TableHead>{t('tableHead.method')}</TableHead>
                <TableHead>{t('tableHead.recipient')}</TableHead>
                <TableHead className="text-right">
                  {t('tableHead.documents')}
                </TableHead>
                <TableHead>{t('tableHead.by')}</TableHead>
                <TableHead>{t('tableHead.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                <LoadingRows />
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {page > 0 ? t('noMore') : t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => <DeliveryRow key={row.id} row={row} />)
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {(page > 0 || hasNext) && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || query.isFetching}
            onClick={() => setPage((current) => current - 1)}
          >
            {t('previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext || query.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  );
}

function DeliveryRow({ row }: { row: RawBundleDelivery }) {
  const t = useTranslations('Accounting.deliveries');
  const tSections = useTranslations('Accounting.templates.sections');
  const { formatDateTime } = useFormatting();
  const pauschale = row.reimbursementTypeKey
    ? pauschaleForReimbursementTypeKey(row.reimbursementTypeKey)
    : undefined;

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap tabular-nums">
        {formatDateTime(new Date(row.occurredAt))}
      </TableCell>
      <TableCell>{row.volunteer?.name ?? '—'}</TableCell>
      <TableCell>
        {pauschale
          ? tSections(
              getPauschaleKey(pauschale) as Parameters<typeof tSections>[0],
            )
          : '—'}
      </TableCell>
      <TableCell>
        <div className="space-y-0.5">
          <p>{t(`method.${row.method}`)}</p>
          {row.issues.length > 0 && (
            <p className="text-xs text-alert">
              {t('withIssues', {
                issues: row.issues
                  .map((issue) => t(`issues.${issue}`))
                  .join(', '),
              })}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {row.recipientEmail ? maskEmail(row.recipientEmail) : '—'}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.invoiceIds.length}
      </TableCell>
      <TableCell>{row.deliveredByUser?.name ?? '—'}</TableCell>
      <TableCell>
        {row.method === BundleDeliveryMethod.Email && row.emailStatus ? (
          <Badge variant={STATUS_VARIANT[row.emailStatus]}>
            {t(`status.${row.emailStatus}`)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function LoadingRows() {
  return [0, 1, 2].map((row) => (
    <TableRow key={row}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((cell) => (
        <TableCell key={cell}>
          <Skeleton className="h-4 w-20" />
        </TableCell>
      ))}
    </TableRow>
  ));
}
