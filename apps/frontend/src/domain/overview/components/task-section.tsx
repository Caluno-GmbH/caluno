'use client';

import { ChevronRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  type OverviewSection,
  overviewSectionHref,
  sectionCanExpand,
  visibleSectionTasks,
} from '../tasks';
import { TaskCard } from './task-card';

export function TaskSection({
  orgUId,
  section,
}: {
  orgUId: string;
  section: OverviewSection;
}) {
  const t = useTranslations('Overview');
  const tasks = visibleSectionTasks(section.tasks, false);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {t(`sections.${section.type}`)}
        </h2>
        {sectionCanExpand(section.tasks) ? (
          <Link
            href={overviewSectionHref(orgUId, section.type)}
            className="ml-auto flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
          >
            {t('seeAll', { count: section.tasks.length })}
            <ChevronRightIcon className="size-4" />
          </Link>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </section>
  );
}
