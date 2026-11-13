'use client';

import { useMyTasks } from '@repo/data/ee';
import { useMyPermissions, useOrgUId } from '@repo/data/react';
import { Badge } from '@repo/ui';
import { visibleOverviewTasks } from './visible-tasks';

/** TodoNavCountBadge — loads EE tasks itself; never fed via OSS nav context. */
export function TodoNavCountBadge() {
  const orgUId = useOrgUId();
  const { data: tasks } = useMyTasks(orgUId);
  const { data: permissions } = useMyPermissions();

  if (!tasks || !permissions) return null;

  const count = visibleOverviewTasks(tasks, {
    organizationUnitId: orgUId,
    permissions: permissions.map((permission) => permission.key),
  }).length;

  if (!count) return null;

  return (
    <Badge variant="neutral" size="count">
      {count}
    </Badge>
  );
}
