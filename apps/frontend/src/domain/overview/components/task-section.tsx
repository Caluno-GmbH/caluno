'use client';

import {
  CheckIcon,
  ChevronRightIcon,
  ClipboardPlus,
  FilePlus,
  OctagonXIcon,
  Package,
  SignatureIcon,
  UserPlus,
  UserSearch,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  type OverviewSection,
  type OverviewSectionId,
  overviewSectionHref,
  sectionPreviewLimit,
  taskIdsWithStartTime,
  visibleSectionTasks,
} from '../tasks';
import {
  FillAssignmentEmpty,
  FillAssignmentFilterControl,
} from './fill-assignment-filter';
import { TaskCard } from './task-card';

const SECTION_ICONS = {
  FILL_OPEN_ASSIGNMENTS: [UserPlus],
  REVIEW_APPLICATIONS: [UserSearch],
  APPROVE_SIGNUPS: [CheckIcon],
  DECLINED_DOCUMENTS: [OctagonXIcon],
  CREATE_AGREEMENTS: [FilePlus],
  CREATE_TIMESHEETS: [ClipboardPlus],
  COUNTERSIGN_DOCUMENTS: [SignatureIcon],
  SEND_TIMESHEET_BUNDLES: [Package],
} as const satisfies Record<OverviewSectionId, readonly (typeof UserPlus)[]>;

export function TaskSection({
  orgUId,
  section,
  layout = 'stack',
  contained,
}: {
  orgUId: string;
  section: OverviewSection;
  /** `columns` places cards in the same two-column track as the sections below. */
  layout?: 'stack' | 'columns';
  /**
   * Wrap a section that spans more than one column.
   * Defaults to on for `columns`, so a future full-width section picks it up.
   */
  contained?: boolean;
}) {
  const t = useTranslations('Todo');
  const isContained = contained ?? layout === 'columns';
  const tasks = visibleSectionTasks(
    section.tasks,
    false,
    sectionPreviewLimit(section.id),
  );
  const withStartTime = taskIdsWithStartTime(tasks);
  const icons = SECTION_ICONS[section.id];

  return (
    <section
      className={
        isContained
          ? 'space-y-3 rounded-2xl border border-border bg-transparent p-3 min-[750px]:p-4'
          : 'min-w-0 space-y-3 min-[750px]:grid min-[750px]:grid-cols-1 min-[750px]:grid-rows-subgrid min-[750px]:row-span-4 min-[750px]:gap-3 min-[750px]:space-y-0'
      }
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="flex max-w-full items-center gap-2 text-base font-semibold">
          <span
            className="flex shrink-0 items-center gap-0.5 text-muted-foreground"
            aria-hidden
          >
            {icons.map((Icon) => (
              <Icon key={Icon.displayName} className="size-4" />
            ))}
          </span>
          <span className="truncate">{t(`sections.${section.id}`)}</span>
          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
            {section.tasks.length}
          </span>
        </h3>
        {section.id === 'FILL_OPEN_ASSIGNMENTS' ? (
          <FillAssignmentFilterControl orgUId={orgUId} />
        ) : null}
        <Link
          href={overviewSectionHref(orgUId, section.id)}
          className="ml-auto flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
        >
          {t('seeAll')}
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>
      {tasks.length === 0 ? (
        section.id === 'FILL_OPEN_ASSIGNMENTS' ? (
          <FillAssignmentEmpty orgUId={orgUId} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        )
      ) : (
        <div
          className={
            layout === 'columns'
              ? isContained
                ? 'grid grid-cols-1 gap-2 min-[750px]:grid-cols-2'
                : 'grid grid-cols-1 gap-2 min-[750px]:grid-cols-2 min-[750px]:gap-x-8'
              : 'flex min-w-0 flex-col gap-2 min-[750px]:grid min-[750px]:grid-cols-1 min-[750px]:grid-rows-subgrid min-[750px]:row-span-3 min-[750px]:gap-2'
          }
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              showStartTime={withStartTime.has(task.id)}
              task={task}
            />
          ))}
        </div>
      )}
    </section>
  );
}
