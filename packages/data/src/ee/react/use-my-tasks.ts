'use client';

import { useQuery } from '@tanstack/react-query';
import { ChangeArea } from '../../react/change-feed/query-meta';
import { useSdk } from '../../react/hooks/use-graphql-client';
import { TaskRepository } from '../task/task.repository';

/**
 * Overview refreshes on its own while the admin is looking at it. The change
 * feed covers only some of the areas tasks are built from (no shifts, events or
 * timesheets yet), and expiring contracts change with the clock rather than a
 * write, so the interval stays until the feed can report all of them.
 */
const MY_TASKS_POLL_MS = 30_000;

export function useMyTasks(organizationUnitId: string) {
  const sdk = useSdk();
  const repository = new TaskRepository(sdk);

  return useQuery({
    queryKey: ['myTasks', organizationUnitId],
    queryFn: () => repository.myTasks(),
    enabled: organizationUnitId.length > 0,
    refetchInterval: MY_TASKS_POLL_MS,
    refetchOnWindowFocus: true,
    meta: {
      changeAreas: [
        ChangeArea.Contracts,
        ChangeArea.Invoices,
        ChangeArea.MembershipRequests,
      ],
    },
  });
}
