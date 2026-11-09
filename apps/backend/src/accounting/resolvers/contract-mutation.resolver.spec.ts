import { describe, expect, it, mock } from 'bun:test';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { NotFoundGraphQLError } from '../../graphql/errors';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { ContractMutationResolver } from './contract-mutation.resolver';

describe('ContractMutationResolver.createContract tenancy', () => {
  const headerUnitId = 'unit-org-b';
  const descendantUnitId = 'unit-org-b-child';
  const foreignVolunteerId = 'volunteer-only-in-org-a';
  const memberVolunteerId = 'volunteer-in-org-b';

  function createResolver(overrides?: {
    assertUserInScope?: ReturnType<typeof mock>;
    assertUnitReadable?: ReturnType<typeof mock>;
    createContract?: ReturnType<typeof mock>;
  }) {
    const createContract =
      overrides?.createContract ?? mock(async () => ({ id: 'contract-1' }));
    const assertUserInScope =
      overrides?.assertUserInScope ??
      mock(async () => {
        /* in scope */
      });
    const assertUnitReadable =
      overrides?.assertUnitReadable ??
      mock(async () => {
        /* in scope */
      });

    const resolver = new ContractMutationResolver(
      {
        createContract,
        signContract: mock(),
        declineContract: mock(),
      } as never,
      { toModelOrThrow: mock((entity: unknown) => entity) } as never,
      {
        resolveEnabledOrganizationId: mock(async () => 'org-b'),
      } as never,
      { assertUserInScope } as never,
      { assertUnitReadable } as never,
    );

    return {
      resolver,
      createContract,
      assertUserInScope,
      assertUnitReadable,
    };
  }

  const baseInput = {
    volunteerId: memberVolunteerId,
    reimbursementTypeId: 'type-1',
    periodStart: new Date('2026-01-01T00:00:00.000Z'),
    periodEnd: new Date('2026-12-31T00:00:00.000Z'),
  };

  const session = { user: { id: 'actor-org-b' } } as UserSession;
  const context = {
    organizationUnitId: headerUnitId,
  } as AuthenticatedGraphQLContext;

  it('rejects a volunteer who is only a member of another organization', async () => {
    const assertUserInScope = mock(async () => {
      throw new NotFoundGraphQLError('Volunteer not found');
    });
    const {
      resolver,
      createContract,
      assertUserInScope: assertFn,
    } = createResolver({ assertUserInScope });

    await expect(
      resolver.createContract(
        { ...baseInput, volunteerId: foreignVolunteerId },
        session,
        context,
      ),
    ).rejects.toBeInstanceOf(NotFoundGraphQLError);

    expect(assertFn).toHaveBeenCalledWith(
      headerUnitId,
      foreignVolunteerId,
      'Volunteer not found',
    );
    expect(createContract).not.toHaveBeenCalled();
  });

  it('rejects an organizationUnitId outside the header unit subtree', async () => {
    const siblingUnitId = 'unit-org-b-sibling';
    const assertUnitReadable = mock(async () => {
      throw new NotFoundGraphQLError('Organization unit not found');
    });
    const {
      resolver,
      createContract,
      assertUnitReadable: assertFn,
    } = createResolver({ assertUnitReadable });

    await expect(
      resolver.createContract(
        { ...baseInput, organizationUnitId: siblingUnitId },
        session,
        context,
      ),
    ).rejects.toBeInstanceOf(NotFoundGraphQLError);

    expect(assertFn).toHaveBeenCalledWith(
      headerUnitId,
      siblingUnitId,
      'Organization unit not found',
    );
    expect(createContract).not.toHaveBeenCalled();
  });

  it('accepts a descendant organizationUnitId and scopes the volunteer to the header', async () => {
    const { resolver, createContract, assertUserInScope, assertUnitReadable } =
      createResolver();

    await resolver.createContract(
      { ...baseInput, organizationUnitId: descendantUnitId },
      session,
      context,
    );

    expect(assertUnitReadable).toHaveBeenCalledWith(
      headerUnitId,
      descendantUnitId,
      'Organization unit not found',
    );
    expect(assertUserInScope).toHaveBeenCalledWith(
      headerUnitId,
      memberVolunteerId,
      'Volunteer not found',
    );
    expect(createContract).toHaveBeenCalledWith(
      'org-b',
      expect.objectContaining({
        volunteerId: memberVolunteerId,
        organizationUnitId: descendantUnitId,
      }),
      'actor-org-b',
    );
  });

  it('defaults organizationUnitId to the header and scopes the volunteer there', async () => {
    const { resolver, createContract, assertUserInScope, assertUnitReadable } =
      createResolver();

    await resolver.createContract(baseInput, session, context);

    expect(assertUnitReadable).not.toHaveBeenCalled();
    expect(assertUserInScope).toHaveBeenCalledWith(
      headerUnitId,
      memberVolunteerId,
      'Volunteer not found',
    );
    expect(createContract).toHaveBeenCalledWith(
      'org-b',
      expect.objectContaining({
        organizationUnitId: headerUnitId,
      }),
      'actor-org-b',
    );
  });
});
