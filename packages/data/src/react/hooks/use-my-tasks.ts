'use client';

import { TaskRepository } from '@repo/data';
import { useQuery } from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';

/** Overview refreshes on its own while the admin is looking at it. */
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
  });
}
