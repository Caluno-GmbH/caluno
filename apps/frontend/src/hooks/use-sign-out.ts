'use client';

import { useQueryClient } from '@repo/data/react';
import { useCallback } from 'react';
import { signOut as authSignOut } from '@/lib/auth';

export function useSignOut() {
  const queryClient = useQueryClient();

  return useCallback(
    async (...args: Parameters<typeof authSignOut>) => {
      const result = await authSignOut(...args);
      queryClient.clear();
      sessionStorage.clear();
      return result;
    },
    [queryClient],
  );
}
