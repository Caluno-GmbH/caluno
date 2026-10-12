'use client';

import { TermsRepository } from '@repo/data';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AcceptTermsInput } from '../../generated/base-types';
import { useSdk } from './use-graphql-client';

export function useTermsStatus() {
  const sdk = useSdk();
  const repository = new TermsRepository(sdk);
  return useQuery({
    queryKey: ['terms-status'],
    queryFn: () => repository.getStatus(),
    staleTime: 0,
  });
}

export function useAcceptTerms() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new TermsRepository(sdk);
  return useMutation({
    mutationFn: (input: AcceptTermsInput) => repository.accept(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms-status'] });
    },
  });
}
