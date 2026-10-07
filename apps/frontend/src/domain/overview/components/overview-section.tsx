'use client';

import type { PermissionKey } from '@repo/data';
import { Button, Empty, EmptyDescription, EmptyHeader } from '@repo/ui';
import { ChevronLeftIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { OverviewTaskType } from '../tasks';
import { useOverviewTasks } from '../use-overview-tasks';
import { TaskCard } from './task-card';

export function OverviewSection({
  orgUId,
  permissions,
  type,
}: {
  orgUId: string;
  permissions: PermissionKey[];
  type: OverviewTaskType;
}) {
  const t = useTranslations('Overview');
  const { sections, isPending, isError } = useOverviewTasks(
    orgUId,
    permissions,
  );
  const section = sections.find((item) => item.type === type);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/${orgUId}`}>
            <ChevronLeftIcon />
            {t('back')}
          </Link>
        </Button>
        <h1 className="page-title">{t(`sections.${type}`)}</h1>
      </div>
      {isPending ? null : isError ? (
        <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>
      ) : !section ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyDescription>{t('empty')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-2 min-[750px]:grid-cols-2">
          {section.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
