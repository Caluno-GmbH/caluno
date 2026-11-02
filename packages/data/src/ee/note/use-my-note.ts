'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateMyNoteInput } from '../../generated/base-types';
import { useSdk } from '../../react/hooks/use-graphql-client';
import { NoteRepository } from './note.repository';

export function useMyNote(enabled = true) {
  const sdk = useSdk();
  const repository = new NoteRepository(sdk);
  return useQuery({
    queryKey: ['my-note'],
    queryFn: () => repository.getMyNote(),
    enabled,
  });
}

export function useUpdateMyNote() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new NoteRepository(sdk);
  return useMutation({
    mutationFn: (input: UpdateMyNoteInput) => repository.updateMyNote(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-note'] });
    },
  });
}
