'use client';

import { ReimbursementTypeKey } from '@repo/data';
import { Avatar, AvatarFallback, Card } from '@repo/ui';
import { CalendarIcon, TicketIcon, UsersRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DocTypeHeader } from '@/domain/accounting/components/doc-type-header';
import { pauschaleForReimbursementTypeKey } from '@/domain/accounting/lib/reimbursement-type-mapping';
import { Link } from '@/i18n/navigation';
import {
  formatAppliedWhen,
  formatDaysAway,
  formatStatusAge,
  formatUpcomingWhen,
  STATUS_WARNING_AFTER_DAYS,
} from '@/lib/formatting/relative-day';
import { getInitials } from '@/lib/get-initials';
import type { OverviewTask } from '../tasks';
import {
  OverviewCardIdentity,
  OverviewCardLayout,
  OverviewChipStack,
  OverviewStatusBadge,
  OverviewTypeIcon,
} from './overview-card';

export function TaskCard({
  task,
  showStartTime = false,
}: {
  task: OverviewTask;
  showStartTime?: boolean;
}) {
  return (
    <Link
      href={task.href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1"
    >
      <Card className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-accent/40">
        <TaskCardBody showStartTime={showStartTime} task={task} />
      </Card>
    </Link>
  );
}

function TaskCardBody({
  task,
  showStartTime,
}: {
  task: OverviewTask;
  showStartTime: boolean;
}) {
  const value = (key: string) =>
    task.details.find((detail) => detail.key === key)?.value;

  if (task.type === 'SHIFT_BELOW_MINIMUM') {
    return <BelowMinimumTaskBody showStartTime={showStartTime} value={value} />;
  }

  if (task.type === 'SHIFT_APPROVAL' || task.type === 'EVENT_APPROVAL') {
    return (
      <ShiftTaskBody showStartTime={showStartTime} task={task} value={value} />
    );
  }

  if (task.type === 'MEMBERSHIP_REQUEST') {
    return <MembershipTaskBody task={task} value={value} />;
  }

  return <DocumentTaskBody task={task} value={value} />;
}

function BelowMinimumTaskBody({
  value,
  showStartTime,
}: {
  value: (key: string) => string | undefined;
  showStartTime: boolean;
}) {
  const t = useTranslations('Todo');
  const locale = useLocale();
  const approved = asCount(value('approvedCount'));
  const minimum = asCount(value('minimum'));
  const maximum = asCount(value('maximum'));
  const schedule = formatUpcomingWhen(value('startsAt'), value('endsAt'), {
    locale,
  });
  const daysAway = formatDaysAway(value('startsAt'), { locale });
  const staffing =
    approved !== undefined && maximum !== undefined
      ? {
          text: t('filledOf', { filled: approved, total: maximum }),
          label: t('filledSpots', { filled: approved, total: maximum }),
        }
      : approved !== undefined && minimum !== undefined
        ? {
            text: t('short', { missing: Math.max(0, minimum - approved) }),
          }
        : undefined;

  return (
    <OverviewCardLayout
      badge={
        <OverviewChipStack>
          {daysAway ? (
            <OverviewStatusBadge tone={daysAway.tone}>
              {daysAway.label}
            </OverviewStatusBadge>
          ) : null}
          {staffing ? (
            <OverviewStatusBadge icon={UsersRound} label={staffing.label}>
              {staffing.text}
            </OverviewStatusBadge>
          ) : null}
        </OverviewChipStack>
      }
    >
      <OverviewCardIdentity
        leading={<OverviewTypeIcon icon={CalendarIcon} />}
        meta={
          schedule ? (
            <>
              {schedule.dateLabel}
              {showStartTime ? ` · ${schedule.startTime}` : null}
            </>
          ) : undefined
        }
        title={value('title')}
      />
    </OverviewCardLayout>
  );
}

function ShiftTaskBody({
  task,
  value,
  showStartTime,
}: {
  task: OverviewTask;
  value: (key: string) => string | undefined;
  showStartTime: boolean;
}) {
  const t = useTranslations('Todo');
  const locale = useLocale();
  const openRequests = asCount(value('openRequestCount'));
  const schedule = formatUpcomingWhen(value('startsAt'), value('endsAt'), {
    locale,
  });
  const daysAway = formatDaysAway(value('startsAt'), { locale });

  return (
    <OverviewCardLayout
      badge={
        <OverviewChipStack>
          {daysAway ? (
            <OverviewStatusBadge tone={daysAway.tone}>
              {daysAway.label}
            </OverviewStatusBadge>
          ) : null}
          {openRequests !== undefined ? (
            <OverviewStatusBadge>
              {t('waiting', { count: openRequests })}
            </OverviewStatusBadge>
          ) : null}
        </OverviewChipStack>
      }
    >
      <OverviewCardIdentity
        leading={
          <OverviewTypeIcon
            icon={task.type === 'EVENT_APPROVAL' ? TicketIcon : CalendarIcon}
          />
        }
        meta={
          schedule ? (
            <>
              {schedule.dateLabel}
              {showStartTime ? ` · ${schedule.startTime}` : null}
            </>
          ) : undefined
        }
        title={value('title')}
      />
    </OverviewCardLayout>
  );
}

function MembershipTaskBody({
  task,
  value,
}: {
  task: OverviewTask;
  value: (key: string) => string | undefined;
}) {
  const tOverview = useTranslations('Todo');
  const locale = useLocale();
  const name = [value('firstName'), value('lastName')]
    .filter(Boolean)
    .join(' ');
  const applied = formatAppliedWhen(task.sortAt, { locale });
  const label = applied
    ? tOverview('appliedRelative', {
        when: appliedChipWhen(applied.relative, locale),
      })
    : undefined;

  return (
    <OverviewCardLayout
      badge={
        label ? (
          <OverviewStatusBadge tone={applied?.tone ?? 'neutral'}>
            {label}
          </OverviewStatusBadge>
        ) : null
      }
    >
      <OverviewCardIdentity
        leading={
          <Avatar>
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
        }
        meta={value('email')}
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
  const locale = useLocale();
  const tDocs = useTranslations('MembershipDetail.documents');
  const tTiles = useTranslations('Accounting.reimbursements.tiles');
  const tOverview = useTranslations('Todo');
  const pauschale = pauschaleOf(task.reimbursementTypeKey);
  const name = value('volunteerName');
  const hours = value('hours');
  const readyCount = asCount(value('readyCount'));
  const declineReason = value('declineReason');
  const meta = joinMeta(
    documentTypeLabel(task.type, tOverview),
    value('period') ?? value('month'),
    hours ? tOverview('hours', { hours }) : undefined,
    value('amount'),
  );

  const declinedAge =
    task.type === 'DOCUMENT_DECLINED'
      ? formatStatusAge(value('declinedAt'), {
          locale,
          warningAfterDays: STATUS_WARNING_AFTER_DAYS.declinedDocuments.warning,
        })
      : undefined;
  const signedAge =
    task.type === 'CONTRACT_SIGN' || task.type === 'TIMESHEET_SIGN'
      ? formatStatusAge(value('signedAt'), {
          locale,
          warningAfterDays:
            STATUS_WARNING_AFTER_DAYS.countersignDocuments.warning,
        })
      : undefined;

  const badge =
    task.type === 'DOCUMENT_DECLINED' ? (
      <OverviewStatusBadge tone={declinedAge?.tone ?? 'neutral'}>
        {declinedAge
          ? tOverview('declinedAgo', { when: declinedAge.relative })
          : tDocs('status.declined')}
      </OverviewStatusBadge>
    ) : task.type === 'CONTRACT_SIGN' || task.type === 'TIMESHEET_SIGN' ? (
      <OverviewStatusBadge tone={signedAge?.tone ?? 'neutral'}>
        {signedAge
          ? tOverview('signedAgo', { when: signedAge.relative })
          : tDocs('status.awaiting-countersignature')}
      </OverviewStatusBadge>
    ) : task.type === 'CONTRACT_CREATE' ? (
      <OverviewStatusBadge>{tTiles('contractGenerate')}</OverviewStatusBadge>
    ) : task.type === 'INVOICE_CREATE' ? (
      <OverviewStatusBadge>{tTiles('timesheetGenerate')}</OverviewStatusBadge>
    ) : readyCount !== undefined ? (
      <OverviewStatusBadge>
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
          wrapTopLine
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

function appliedChipWhen(relative: string, locale: string): string {
  if (locale !== 'de') return relative;
  return relative.charAt(0).toLocaleUpperCase('de-DE') + relative.slice(1);
}

function documentTypeLabel(
  type: OverviewTask['type'],
  t: (key: 'types.contract' | 'types.timesheet') => string,
): string | undefined {
  if (type === 'CONTRACT_SIGN' || type === 'CONTRACT_CREATE') {
    return t('types.contract');
  }
  if (
    type === 'TIMESHEET_SIGN' ||
    type === 'TIMESHEET_BUNDLES' ||
    type === 'INVOICE_CREATE'
  ) {
    return t('types.timesheet');
  }
  return undefined;
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
