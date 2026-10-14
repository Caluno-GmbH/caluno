'use client';

import {
  TaskRepository,
  TodoFillThreshold,
  type UpdateTodoFillAssignmentFilterMutationVariables,
} from '@repo/data';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSdk } from './use-graphql-client';

export const DEFAULT_TODO_FILL_FILTER = {
  threshold: TodoFillThreshold.BelowMinimum,
  daysAhead: 14,
} as const;

type TodoFillFilterInput =
  UpdateTodoFillAssignmentFilterMutationVariables['input'];

export function todoFillFilterKey(organizationUnitId: string) {
  return ['todoFillAssignmentFilter', organizationUnitId] as const;
}

export function useTodoFillFilter(organizationUnitId: string) {
  const sdk = useSdk();
  const repository = new TaskRepository(sdk);
  const queryClient = useQueryClient();
  const queryKey = todoFillFilterKey(organizationUnitId);

  const query = useQuery({
    queryKey,
    queryFn: () => repository.todoFillAssignmentFilter(),
    enabled: organizationUnitId.length > 0,
  });
  const pending = useRef(Promise.resolve());

  const update = (input: TodoFillFilterInput) => {
    const previous = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, input);
    pending.current = pending.current.then(async () => {
      const current = queryClient.getQueryData<TodoFillFilterInput>(queryKey);
      if (
        !current ||
        current.threshold !== input.threshold ||
        current.daysAhead !== input.daysAhead
      ) {
        return;
      }
      try {
        await repository.updateTodoFillAssignmentFilter(input);
        await queryClient.invalidateQueries({
          queryKey: ['myTasks', organizationUnitId],
        });
      } catch {
        if (previous) queryClient.setQueryData(queryKey, previous);
      }
    });
  };

  return {
    filter: query.data ?? DEFAULT_TODO_FILL_FILTER,
    update,
  };
}
