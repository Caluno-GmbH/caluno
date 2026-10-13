'use client';

import type { PermissionKey } from '@repo/data';
import { Empty, EmptyDescription, EmptyHeader } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { type OverviewSection, sectionSpansColumns } from '../tasks';
import { useOverviewTasks } from '../use-overview-tasks';
import { TaskSection } from './task-section';

export function OverviewBoard({
  orgUId,
  permissions,
}: {
  orgUId: string;
  permissions: PermissionKey[];
}) {
  const t = useTranslations('Todo');
  const { groups, isPending, isError } = useOverviewTasks(orgUId, permissions);

  if (isPending) return null;
  if (isError) {
    return <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>;
  }

  if (groups.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyDescription>{t('empty')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.id} className="space-y-4">
          <h2 className="text-xs font-medium text-muted-foreground">
            {t(`groups.${group.id}`)}
          </h2>
          {group.id === 'volunteersAndShifts' ? (
            <VolunteersAndShifts orgUId={orgUId} sections={group.sections} />
          ) : (
            <SectionColumns orgUId={orgUId} sections={group.sections} />
          )}
        </div>
      ))}
    </div>
  );
}

function VolunteersAndShifts({
  orgUId,
  sections,
}: {
  orgUId: string;
  sections: OverviewSection[];
}) {
  const spanning = sections.filter((section) =>
    sectionSpansColumns(section.id),
  );
  const alongside = sections.filter(
    (section) => !sectionSpansColumns(section.id),
  );

  return (
    <div className="flex flex-col gap-8">
      {spanning.map((section) => (
        <TaskSection
          key={section.id}
          contained
          layout="columns"
          orgUId={orgUId}
          section={section}
        />
      ))}
      {alongside.length > 0 ? (
        <SectionColumns orgUId={orgUId} sections={alongside} />
      ) : null}
    </div>
  );
}

function SectionColumns({
  orgUId,
  sections,
}: {
  orgUId: string;
  sections: OverviewSection[];
}) {
  return (
    <div className="grid grid-cols-1 gap-8 min-[750px]:grid-cols-2">
      {sections.map((section) => (
        <TaskSection key={section.id} orgUId={orgUId} section={section} />
      ))}
    </div>
  );
}
