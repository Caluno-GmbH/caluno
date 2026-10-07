'use client';

import { ReimbursementTypeKey } from '@repo/data';
import { Avatar, AvatarFallback, Card } from '@repo/ui';
import {
  CalendarIcon,
  Clock3Icon,
  FilesIcon,
  OctagonXIcon,
  SignatureIcon,
  TicketIcon,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DocTypeHeader } from '@/domain/accounting/components/doc-type-header';
import { pauschaleForReimbursementTypeKey } from '@/domain/accounting/lib/reimbursement-type-mapping';
import { Link } from '@/i18n/navigation';
import { getInitials } from '@/lib/get-initials';
import type { OverviewTask } from '../tasks';
import {
  OverviewCardIdentity,
  OverviewCardLayout,
  OverviewStatusBadge,
  OverviewTypeIcon,
} from './overview-card';

export function TaskCard({ task }: { task: OverviewTask }) {
  return (
    <Link
      href={task.href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1"
    >
      <Card className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-accent/40">
        <TaskCardBody task={task} />
      </Card>
    </Link>
  );
}

function TaskCardBody({ task }: { task: OverviewTask }) {
  const value = (key: string) =>
    task.details.find((detail) => detail.key === key)?.value;

  if (
    task.type === 'SHIFT_BELOW_MINIMUM' ||
    task.type === 'SHIFT_APPROVAL' ||
    task.type === 'EVENT_APPROVAL'
  ) {
    return <ShiftTaskBody task={task} value={value} />;
  }

  if (task.type === 'MEMBERSHIP_REQUEST') {
    return <MembershipTaskBody value={value} />;
  }

  return <DocumentTaskBody task={task} value={value} />;
}

function ShiftTaskBody({
  task,
  value,
}: {
  task: OverviewTask;
  value: (key: string) => string | undefined;
}) {
  const t = useTranslations('Overview');
  const approved = asCount(value('approvedCount'));
  const minimum = asCount(value('minimum'));
  const openRequests = asCount(value('openRequestCount'));
  const waiting =
    task.type !== 'SHIFT_BELOW_MINIMUM' && openRequests !== undefined;

  return (
    <OverviewCardLayout
      badge={
        approved !== undefined && minimum !== undefined ? (
          <OverviewStatusBadge icon={UsersRound}>
            {t('short', { missing: Math.max(0, minimum - approved) })}
          </OverviewStatusBadge>
        ) : waiting ? (
          <OverviewStatusBadge icon={Clock3Icon}>
            {t('waiting', { count: openRequests })}
          </OverviewStatusBadge>
        ) : null
      }
    >
      <OverviewCardIdentity
        leading={
          <OverviewTypeIcon
            icon={task.type === 'EVENT_APPROVAL' ? TicketIcon : CalendarIcon}
          />
        }
        meta={joinMeta(value('date'), value('time'))}
        title={value('title')}
      />
    </OverviewCardLayout>
  );
}

function MembershipTaskBody({
  value,
}: {
  value: (key: string) => string | undefined;
}) {
  const t = useTranslations('MembershipRequest');
  const name = [value('firstName'), value('lastName')]
    .filter(Boolean)
    .join(' ');
  const requestedAt = value('requestedAt');

  return (
    <OverviewCardLayout
      badge={
        <OverviewStatusBadge icon={UserPlus}>
          {t('status.requested')}
        </OverviewStatusBadge>
      }
    >
      <OverviewCardIdentity
        leading={
          <Avatar>
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
        }
        meta={
          requestedAt
            ? t('meta.requestedDate', { date: requestedAt })
            : undefined
        }
        title={name}
      />
    </OverviewCardLayout>
  );
}

function DocumentTaskBody({
  task,
  value,
}: {
  task: OverviewTask;
  value: (key: string) => string | undefined;
}) {
  const tDocs = useTranslations('MembershipDetail.documents');
  const tTiles = useTranslations('Accounting.reimbursements.tiles');
  const tOverview = useTranslations('Overview');
  const pauschale = pauschaleOf(task.reimbursementTypeKey);
  const name = value('volunteerName');
  const hours = value('hours');
  const readyCount = asCount(value('readyCount'));
  const declineReason = value('declineReason');
  const meta = joinMeta(
    value('period') ?? value('month'),
    hours ? tOverview('hours', { hours }) : undefined,
    value('amount'),
  );

  const badge =
    task.type === 'DOCUMENT_DECLINED' ? (
      <OverviewStatusBadge icon={OctagonXIcon}>
        {tDocs('status.declined')}
      </OverviewStatusBadge>
    ) : task.type === 'CONTRACT_SIGN' || task.type === 'TIMESHEET_SIGN' ? (
      <OverviewStatusBadge icon={SignatureIcon}>
        {tDocs('status.awaiting-countersignature')}
      </OverviewStatusBadge>
    ) : readyCount !== undefined ? (
      <OverviewStatusBadge icon={FilesIcon}>
        {tTiles('docCount', { count: readyCount })}
      </OverviewStatusBadge>
    ) : null;

  return (
    <OverviewCardLayout badge={badge}>
      {pauschale ? (
        <DocTypeHeader
          kind={task.documentKind ?? 'custom'}
          pauschale={pauschale}
          topLine={meta ?? ''}
          name={name ?? ''}
        >
          <DeclineReason reason={declineReason} />
        </DocTypeHeader>
      ) : (
        <OverviewCardIdentity meta={meta} title={name}>
          <DeclineReason reason={declineReason} />
        </OverviewCardIdentity>
      )}
    </OverviewCardLayout>
  );
}

function DeclineReason({ reason }: { reason?: string }) {
  if (!reason) return null;
  return <q className="mt-1 block text-sm text-muted-foreground">{reason}</q>;
}

function joinMeta(...parts: Array<string | undefined>) {
  const line = parts.filter(Boolean).join(' · ');
  return line || undefined;
}

function pauschaleOf(key: string | undefined) {
  if (
    key !== ReimbursementTypeKey.Ehrenamt &&
    key !== ReimbursementTypeKey.Uebungsleiter
  ) {
    return null;
  }
  return pauschaleForReimbursementTypeKey(key);
}

function asCount(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const count = Number(value);
  return Number.isFinite(count) ? count : undefined;
}
