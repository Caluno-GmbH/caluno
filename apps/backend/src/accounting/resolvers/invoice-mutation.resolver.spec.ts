import { describe, expect, it, mock } from 'bun:test';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ForbiddenGraphQLError } from '../../graphql/errors';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { InvoiceMutationResolver } from './invoice-mutation.resolver';

describe('InvoiceMutationResolver.createInvoice tenancy', () => {
  it('rejects a sibling organization unit in input', async () => {
    const headerUnitId = 'unit-nord';
    const siblingUnitId = 'unit-sued';

    const invoiceService = {
      createInvoice: mock(async () => ({ id: 'invoice-1' })),
    };
    const invoiceMapper = {
      toModelOrThrow: mock((entity: unknown) => entity),
    };
    const accountingOrgAccessService = {
      resolveEnabledOrganizationId: mock(async () => 'org-1'),
    };

    const resolver = new InvoiceMutationResolver(
      invoiceService as never,
      invoiceMapper as never,
      accountingOrgAccessService as never,
    );

    await expect(
      resolver.createInvoice(
        {
          organizationUnitId: siblingUnitId,
          volunteerId: 'volunteer-1',
          reimbursementTypeId: 'type-1',
          timeEntryIds: ['entry-1'],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        { user: { id: 'actor-1' } } as UserSession,
        {
          organizationUnitId: headerUnitId,
        } as AuthenticatedGraphQLContext,
      ),
    ).rejects.toBeInstanceOf(ForbiddenGraphQLError);

    expect(invoiceService.createInvoice).not.toHaveBeenCalled();
  });
});
