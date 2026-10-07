'use client';

import type { PermissionKey } from '@repo/data';
import { Empty, EmptyDescription, EmptyHeader } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useOverviewTasks } from '../use-overview-tasks';
import { TaskSection } from './task-section';

export function OverviewBoard({
  orgUId,
  permissions,
}: {
  orgUId: string;
  permissions: PermissionKey[];
}) {
  const t = useTranslations('Overview');
  const { sections, isPending, isError } = useOverviewTasks(
    orgUId,
    permissions,
  );

  if (isPending) return null;
  if (isError) {
    return <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>;
  }

  if (sections.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyDescription>{t('empty')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 min-[750px]:grid-cols-2">
      {sections.map((section) => (
        <TaskSection key={section.type} orgUId={orgUId} section={section} />
      ))}
    </div>
  );
}
