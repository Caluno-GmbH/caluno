'use client';

import { PermissionKey } from '@repo/data';
import { useMyTasks } from '@repo/data/react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { mapOverviewTask } from './map-task';
import {
  groupOverviewBoard,
  type OverviewGroup,
  type OverviewSection,
} from './tasks';
import { visibleOverviewTasks } from './visible-tasks';

export function useOverviewTasks(
  orgUId: string,
  permissions: PermissionKey[],
): {
  groups: OverviewGroup[];
  sections: OverviewSection[];
  isPending: boolean;
  isError: boolean;
} {
  const tType = useTranslations('Shift.paidMarker');
  const locale = useLocale();
  const { data, isPending, isError } = useMyTasks(orgUId);
  const groups = useMemo(() => {
    const visible = visibleOverviewTasks(data ?? [], {
      organizationUnitId: orgUId,
      permissions,
    });
    const tasks = visible.map((task) =>
      mapOverviewTask(task, locale, {
        reimbursementType: (key) => {
          if (key === 'EHRENAMT') return tType('ehrenamt');
          if (key === 'UEBUNGSLEITER') return tType('uebungsleiter');
          return key;
        },
      }),
    );
    return groupOverviewBoard(tasks, {
      keepEmptyFill: permissions.includes(PermissionKey.ShiftEdit),
    });
  }, [data, locale, orgUId, permissions, tType]);

  return {
    groups,
    sections: groups.flatMap((group) => group.sections),
    isPending,
    isError,
  };
}
