'use client';

import { type UpdateMyProfileInput, UserRepository } from '@repo/data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';

/**
 * Saves the volunteer's own profile fields (the global `users` columns). The
 * profile feeds every document's `missingProfileFields`, so all accounting
 * document queries — including the single-document caches, by prefix — are
 * invalidated on success.
 */
export function useUpdateMyProfile() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new UserRepository(sdk);

  return useMutation({
    mutationFn: (input: UpdateMyProfileInput) =>
      repository.updateMyProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'my-documents'],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'my-document-summary'],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'my-contracts'],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'my-invoices'],
      });
      queryClient.invalidateQueries({ queryKey: ['accounting', 'contract'] });
      queryClient.invalidateQueries({ queryKey: ['accounting', 'invoice'] });
    },
  });
}
