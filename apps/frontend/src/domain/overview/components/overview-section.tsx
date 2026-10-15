'use client';

import type { PermissionKey } from '@repo/data';
import { Button, Empty, EmptyDescription, EmptyHeader } from '@repo/ui';
import { ChevronLeftIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { type OverviewSectionId, taskIdsWithStartTime } from '../tasks';
import { useOverviewTasks } from '../use-overview-tasks';
import {
  FillAssignmentEmpty,
  FillAssignmentFilterControl,
} from './fill-assignment-filter';
import { TaskCard } from './task-card';

export function OverviewSection({
  orgUId,
  permissions,
  sectionId,
}: {
  orgUId: string;
  permissions: PermissionKey[];
  sectionId: OverviewSectionId;
}) {
  const t = useTranslations('Todo');
  const { sections, isPending, isError } = useOverviewTasks(
    orgUId,
    permissions,
  );
  const section = sections.find((item) => item.id === sectionId);
  const withStartTime = section
    ? taskIdsWithStartTime(section.tasks)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/${orgUId}`}>
            <ChevronLeftIcon />
            {t('back')}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="page-title">
            {t(`sections.${sectionId}`)}
            {section
              ? ` (${section.tasks.length})`
              : sectionId === 'FILL_OPEN_ASSIGNMENTS' && !isPending
                ? ' (0)'
                : ''}
          </h1>
          {sectionId === 'FILL_OPEN_ASSIGNMENTS' ? (
            <FillAssignmentFilterControl orgUId={orgUId} />
          ) : null}
        </div>
      </div>
      {isPending ? null : isError ? (
        <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>
      ) : !section || section.tasks.length === 0 ? (
        sectionId === 'FILL_OPEN_ASSIGNMENTS' ? (
          <FillAssignmentEmpty orgUId={orgUId} />
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyDescription>{t('empty')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      ) : (
        <div className="grid grid-cols-1 gap-2 min-[750px]:grid-cols-2">
          {section.tasks.map((task) => (
            <TaskCard
              key={task.id}
              showStartTime={withStartTime?.has(task.id)}
              task={task}
            />
          ))}
        </div>
      )}
    </div>
  );
}
