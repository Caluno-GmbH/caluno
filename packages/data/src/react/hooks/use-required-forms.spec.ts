import { describe, expect, it } from 'bun:test';
import { RequiredFormTargetType } from '@repo/data';
import type { QueryClient } from '@tanstack/react-query';
import {
  invalidateSetRequiredFormsQueries,
  invalidateSubmitRequiredFormQueries,
} from './use-required-forms';

function recordInvalidations() {
  const keys: unknown[][] = [];
  const queryClient = {
    invalidateQueries: ({ queryKey }: { queryKey: unknown[] }) => {
      keys.push(queryKey);
    },
  } as unknown as QueryClient;
  return { keys, queryClient };
}

describe('invalidateSetRequiredFormsQueries', () => {
  // A join page opened before an admin changes the required forms must pick
  // up the new requirement.
  it('refreshes the unit and its public join page', () => {
    const { keys, queryClient } = recordInvalidations();

    invalidateSetRequiredFormsQueries(queryClient, 'unit-1');

    expect(keys).toContainEqual(['organization-unit', 'unit-1']);
    expect(keys).toContainEqual(['publicOrganizationUnit', 'unit-1']);
  });
});

describe('invalidateSubmitRequiredFormQueries', () => {
  // Submitting flips the "already submitted" state, which the submission lists
  // read; the mutation does not know their unit or user, so they go by prefix.
  it('refreshes the unit and every submission list for a unit form', () => {
    const { keys, queryClient } = recordInvalidations();

    invalidateSubmitRequiredFormQueries(
      queryClient,
      RequiredFormTargetType.OrganizationUnit,
      'unit-1',
    );

    expect(keys).toContainEqual(['organization-unit', 'unit-1']);
    expect(keys).toContainEqual(['myFormSubmissions']);
    expect(keys).toContainEqual(['formSubmissionsForVolunteer']);
  });

  it('refreshes the event and every submission list for an event form', () => {
    const { keys, queryClient } = recordInvalidations();

    invalidateSubmitRequiredFormQueries(
      queryClient,
      RequiredFormTargetType.Event,
      'event-1',
    );

    expect(keys).toContainEqual(['publicEvent', 'event-1']);
    expect(keys).toContainEqual(['event', 'event-1']);
    expect(keys).toContainEqual(['myFormSubmissions']);
    expect(keys).toContainEqual(['formSubmissionsForVolunteer']);
  });
});
