import { NotFoundGraphQLError } from '../graphql/errors';
import { TenantScopeService } from './tenant-scope.service';

// root -> branch -> leaf, plus an unrelated sibling branch
const PARENT_OF: Record<string, string | null> = {
  root: null,
  branch: 'root',
  leaf: 'branch',
  sibling: 'root',
};

const ORGANIZATION_OF: Record<string, string> = {
  root: 'org-a',
  branch: 'org-a',
  leaf: 'org-a',
  sibling: 'org-a',
  foreign: 'org-b',
};

const MEMBERSHIP_UNITS_OF: Record<string, (string | null)[]> = {
  'volunteer-in-leaf': ['sibling', 'leaf'],
  'volunteer-unitless-and-leaf': [null, 'leaf'],
  'volunteer-in-root': ['root'],
  'volunteer-in-sibling': ['sibling'],
  'volunteer-without-membership': [],
};

function createService() {
  const db = {
    query: {
      memberships: {
        findMany: jest.fn(async ({ where }: { where: { userId: string } }) =>
          (MEMBERSHIP_UNITS_OF[where.userId] ?? []).map(
            (organizationUnitId) => ({ organizationUnitId }),
          ),
        ),
      },
    },
  };
  const unitData = {
    listInclusiveAncestorUnitIds: jest.fn(async (unitId: string) => {
      const chain: string[] = [];
      let current: string | null | undefined = unitId;
      while (current && current in PARENT_OF) {
        chain.push(current);
        current = PARENT_OF[current];
      }
      return chain;
    }),
    findById: jest.fn(async (unitId: string) =>
      unitId in PARENT_OF
        ? { id: unitId, parentId: PARENT_OF[unitId] }
        : undefined,
    ),
    findOrganizationIdByUnitId: jest.fn(async (unitId: string) => {
      const organizationId = ORGANIZATION_OF[unitId];
      if (!organizationId) throw new NotFoundGraphQLError('unit not found');
      return organizationId;
    }),
  };
  const service = new TenantScopeService(db as never, unitData as never);
  return Object.assign(service, { unitData });
}

describe('TenantScopeService.assertResourceInScope', () => {
  it('accepts a resource in the header unit itself', async () => {
    await expect(
      createService().assertResourceInScope('branch', 'branch'),
    ).resolves.toBeUndefined();
  });

  it('accepts a resource in a descendant of the header unit', async () => {
    await expect(
      createService().assertResourceInScope('root', 'leaf'),
    ).resolves.toBeUndefined();
  });

  it('rejects a resource in a sibling branch', async () => {
    await expect(
      createService().assertResourceInScope('branch', 'sibling'),
    ).rejects.toBeInstanceOf(NotFoundGraphQLError);
  });

  it('rejects a resource in an ancestor of the header unit', async () => {
    await expect(
      createService().assertResourceInScope('leaf', 'root'),
    ).rejects.toBeInstanceOf(NotFoundGraphQLError);
  });

  it('rejects a resource in another organization', async () => {
    await expect(
      createService().assertResourceInScope('root', 'foreign'),
    ).rejects.toBeInstanceOf(NotFoundGraphQLError);
  });

  it.each([null, undefined, ''])(
    'rejects a resource without a unit (%p)',
    async (resourceUnitId) => {
      await expect(
        createService().assertResourceInScope('root', resourceUnitId),
      ).rejects.toBeInstanceOf(NotFoundGraphQLError);
    },
  );

  it('rejects with the given message', async () => {
    await expect(
      createService().assertResourceInScope('branch', 'sibling', 'No role'),
    ).rejects.toThrow('No role');
  });
});

describe('TenantScopeService.assertUserInScope', () => {
  it('accepts a user with a membership below the header unit', async () => {
    await expect(
      createService().assertUserInScope('branch', 'volunteer-in-leaf'),
    ).resolves.toBeUndefined();
  });

  it('skips memberships without a unit', async () => {
    await expect(
      createService().assertUserInScope(
        'branch',
        'volunteer-unitless-and-leaf',
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects a user whose memberships sit above the header unit', async () => {
    await expect(
      createService().assertUserInScope('branch', 'volunteer-in-root'),
    ).rejects.toBeInstanceOf(NotFoundGraphQLError);
  });

  it('rejects a user whose memberships are all outside the header unit', async () => {
    await expect(
      createService().assertUserInScope('branch', 'volunteer-in-sibling'),
    ).rejects.toBeInstanceOf(NotFoundGraphQLError);
  });

  it('rejects a user without memberships, with the given message', async () => {
    await expect(
      createService().assertUserInScope(
        'root',
        'volunteer-without-membership',
        'Volunteer not found',
      ),
    ).rejects.toThrow('Volunteer not found');
  });
});

describe('TenantScopeService.assertOrganizationInScope', () => {
  it('accepts a resource of the header unit organization', async () => {
    await expect(
      createService().assertOrganizationInScope('leaf', 'org-a'),
    ).resolves.toBeUndefined();
  });

  it('rejects a resource of another organization', async () => {
    await expect(
      createService().assertOrganizationInScope('leaf', 'org-b'),
    ).rejects.toBeInstanceOf(NotFoundGraphQLError);
  });

  it.each([null, undefined, ''])(
    'rejects a resource without an organization (%p)',
    async (organizationId) => {
      await expect(
        createService().assertOrganizationInScope('leaf', organizationId),
      ).rejects.toBeInstanceOf(NotFoundGraphQLError);
    },
  );
});

describe('TenantScopeService.createBranchMatcher', () => {
  it.each([
    ['the header unit itself', 'branch', 'branch'],
    ['an ancestor of the header unit', 'leaf', 'root'],
    ['a descendant of the header unit', 'root', 'leaf'],
  ])('matches %s', async (_label, headerUnitId, unitId) => {
    const isOnBranch = createService().createBranchMatcher(headerUnitId);
    expect(await isOnBranch(unitId)).toBe(true);
  });

  it.each([
    ['a sibling branch', 'branch', 'sibling'],
    ['a unit of another organization', 'root', 'foreign'],
  ])('does not match %s', async (_label, headerUnitId, unitId) => {
    const isOnBranch = createService().createBranchMatcher(headerUnitId);
    expect(await isOnBranch(unitId)).toBe(false);
  });

  it('walks each unit chain once, however often the unit is asked about', async () => {
    const service = createService();
    const isOnBranch = service.createBranchMatcher('branch');
    await isOnBranch('sibling');
    await isOnBranch('sibling');
    await isOnBranch('leaf');
    await isOnBranch('leaf');
    // header chain once, then one lookup each for sibling and leaf
    expect(service.unitData.listInclusiveAncestorUnitIds).toHaveBeenCalledTimes(
      3,
    );
  });
});

describe('TenantScopeService.assertHeaderUnitIsTopUnit', () => {
  it('accepts the top unit', async () => {
    await expect(
      createService().assertHeaderUnitIsTopUnit('root'),
    ).resolves.toBeUndefined();
  });

  it('rejects a sub-unit, with the given message', async () => {
    await expect(
      createService().assertHeaderUnitIsTopUnit('branch', 'Only the top unit'),
    ).rejects.toThrow('Only the top unit');
  });

  it('rejects an unknown unit', async () => {
    await expect(
      createService().assertHeaderUnitIsTopUnit('missing'),
    ).rejects.toBeInstanceOf(NotFoundGraphQLError);
  });
});
