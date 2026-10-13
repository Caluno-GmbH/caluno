import { describe, expect, it } from 'bun:test';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateContractQueries } from './use-contracts';

function recordInvalidations() {
  const keys: unknown[][] = [];
  const queryClient = {
    invalidateQueries: ({ queryKey }: { queryKey: unknown[] }) => {
      keys.push(queryKey);
    },
  } as unknown as QueryClient;
  return { keys, queryClient };
}

describe('invalidateContractQueries', () => {
  // The board's agreement reminder and "No active agreement" badge are read
  // from these queries, so a contract change has to refresh them (VOLI-1588).
  it('refreshes the invoice and needs-timesheet queries the board derives its reminder and badge from', () => {
    const { keys, queryClient } = recordInvalidations();

    invalidateContractQueries(queryClient);

    expect(keys).toContainEqual(['accounting', 'invoices']);
    expect(keys).toContainEqual(['accounting', 'invoice']);
    expect(keys).toContainEqual([
      'accounting',
      'volunteers-needing-timesheets',
    ]);
  });

  it('refreshes the paid-shift signups, which stop asking for an agreement once one covers the shift', () => {
    const { keys, queryClient } = recordInvalidations();

    invalidateContractQueries(queryClient);

    expect(keys).toContainEqual(['accounting', 'paid-shift-signup-volunteers']);
  });

  it('still refreshes the contract queries', () => {
    const { keys, queryClient } = recordInvalidations();

    invalidateContractQueries(queryClient);

    expect(keys).toContainEqual(['accounting', 'contracts']);
    expect(keys).toContainEqual(['accounting', 'my-contracts']);
  });
});
