import { describe, expect, it, mock } from 'bun:test';
import { ForbiddenGraphQLError } from '../../graphql/errors';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import type { AddTimeEntryInput } from '../inputs/add-time-entry.input';
import { TimeTrackingMutationResolver } from './time-tracking-mutation.resolver';

const context = {
  organizationUnitId: 'unit-1',
} as AuthenticatedGraphQLContext;

const session = { user: { id: 'admin-1' } } as never;

const input = {
  volunteerId: 'volunteer-1',
  startedAt: new Date('2026-01-15T08:00:00.000Z'),
  endedAt: new Date('2026-01-15T09:00:00.000Z'),
} as AddTimeEntryInput;

function buildResolver(isMember = true) {
  const timeTrackingService = {
    addTimeEntry: mock(async () => ({ id: 'te-1' })),
  };
  const entryMapper = {
    toModelOrThrow: mock((entry: { id: string }) => entry),
  };
  const membershipService = {
    isMemberOfUnitOrAncestor: mock(async () => isMember),
  };

  const resolver = new TimeTrackingMutationResolver(
    timeTrackingService as never,
    entryMapper as never,
    {} as never,
    membershipService as never,
  );

  return { resolver, timeTrackingService, membershipService };
}

describe('TimeTrackingMutationResolver.addTimeEntry', () => {
  it('rejects a volunteer who is not a member of the unit or an ancestor', async () => {
    const { resolver, timeTrackingService, membershipService } =
      buildResolver(false);

    await expect(
      resolver.addTimeEntry(input, context, session),
    ).rejects.toBeInstanceOf(ForbiddenGraphQLError);

    expect(membershipService.isMemberOfUnitOrAncestor).toHaveBeenCalledWith(
      'volunteer-1',
      'unit-1',
    );
    expect(timeTrackingService.addTimeEntry).not.toHaveBeenCalled();
  });

  it('creates the entry when the volunteer is a member', async () => {
    const { resolver, timeTrackingService } = buildResolver(true);

    await resolver.addTimeEntry(input, context, session);

    expect(timeTrackingService.addTimeEntry).toHaveBeenCalledWith(
      'unit-1',
      input,
      'admin-1',
    );
  });
});
