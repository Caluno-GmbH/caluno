'use client';

import { UserRepository } from '@repo/data';
import { useQueryClient } from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';
import { useMutation } from './use-mutation';

export function useUnsubscribeFromEmails() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new UserRepository(sdk);

  return useMutation({
    mutationFn: () => repository.unsubscribeFromEmails(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    },
  });
}
