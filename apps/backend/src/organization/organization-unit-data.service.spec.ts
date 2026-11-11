import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';
import { OrganizationUnitDataService } from './organization-unit-data.service';

describe('OrganizationUnitDataService.listInclusiveAncestorUnitIds', () => {
  it('stops on a cyclic parent chain', async () => {
    const rows = new Map([
      ['a', { id: 'a', parentId: 'b' }],
      ['b', { id: 'b', parentId: 'a' }],
    ]);
    const db = {
      query: {
        organizationUnits: {
          findFirst: async (args: { where: { id: string } }) =>
            rows.get(args.where.id),
        },
      },
    };
    const service = new OrganizationUnitDataService(db as never);

    await expect(service.listInclusiveAncestorUnitIds('a')).resolves.toEqual([
      'a',
      'b',
    ]);
  });
});
