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

function createService() {
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
    findOrganizationIdByUnitId: jest.fn(async (unitId: string) => {
      const organizationId = ORGANIZATION_OF[unitId];
      if (!organizationId) throw new NotFoundGraphQLError('unit not found');
      return organizationId;
    }),
  };
  return new TenantScopeService(unitData as never);
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
