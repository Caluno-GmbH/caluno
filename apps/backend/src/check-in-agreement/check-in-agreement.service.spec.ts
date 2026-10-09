import { NotFoundGraphQLError } from '../graphql/errors';
import { AgreementStatus } from './agreement-status.enum';
import { AgreementStatusService } from './check-in-agreement.service';

// ---------------------------------------------------------------------------
// Shared factory helpers
// ---------------------------------------------------------------------------

function makeBaseDeps() {
  const shiftService = {
    findInstanceById: jest.fn().mockResolvedValue({
      id: 'si-1',
      overrideReimbursementTypeId: null,
      master: {
        reimbursementTypeId: 'rt-1',
        organizationUnitId: 'ou-1',
      },
    }),
  };

  const contractService = {
    findContractsForOrganization: jest.fn().mockResolvedValue([]),
  };

  const documentTemplateService = {
    findActiveTemplate: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
  };

  const authService = {
    hasRequiredPermissions: jest.fn().mockResolvedValue(false),
    findUsersWithPermission: jest.fn().mockResolvedValue([]),
  };

  const organizationUnitDataService = {
    findOrganizationByUnitId: jest.fn().mockResolvedValue({ id: 'org-1' }),
  };

  const db = {
    query: {
      reimbursementTypes: {
        findFirst: jest.fn().mockResolvedValue({ key: 'EHRENAMT' }),
      },
    },
  };

  return {
    shiftService,
    contractService,
    documentTemplateService,
    authService,
    organizationUnitDataService,
    db,
  };
}

function makeService(deps: ReturnType<typeof makeBaseDeps>) {
  return new AgreementStatusService(
    deps.shiftService as never,
    deps.contractService as never,
    deps.documentTemplateService as never,
    deps.authService as never,
    deps.organizationUnitDataService as never,
    deps.db as never,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgreementStatusService.resolve', () => {
  it('returns NOT_APPLICABLE and does NOT call auth or contract services when shiftInstanceId is null', async () => {
    const deps = makeBaseDeps();
    const service = makeService(deps);

    const result = await service.resolveAgreement({
      volunteerId: 'v-1',
      organizationUnitId: 'ou-1',
      shiftInstanceId: null,
      callerUserId: 'caller-1',
    });

    expect(result.status).toBe(AgreementStatus.NOT_APPLICABLE);
    expect(result.reimbursementTypeName).toBeNull();
    expect(result.contractId).toBeNull();
    expect(
      deps.contractService.findContractsForOrganization,
    ).not.toHaveBeenCalled();
    expect(deps.authService.hasRequiredPermissions).not.toHaveBeenCalled();
    expect(deps.authService.findUsersWithPermission).not.toHaveBeenCalled();
  });

  it('returns NOT_APPLICABLE when the shift instance has no effective reimbursement type', async () => {
    const deps = makeBaseDeps();
    deps.shiftService.findInstanceById.mockResolvedValue({
      id: 'si-1',
      overrideReimbursementTypeId: null,
      master: { reimbursementTypeId: null, organizationUnitId: 'ou-1' },
    });
    const service = makeService(deps);

    const result = await service.resolveAgreement({
      volunteerId: 'v-1',
      organizationUnitId: 'ou-1',
      shiftInstanceId: 'si-1',
      callerUserId: 'caller-1',
    });

    expect(result.status).toBe(AgreementStatus.NOT_APPLICABLE);
    expect(
      deps.contractService.findContractsForOrganization,
    ).not.toHaveBeenCalled();
    expect(deps.authService.hasRequiredPermissions).not.toHaveBeenCalled();
  });

  it('returns ACTIVE and does NOT call auth services when an ACTIVE contract covers now; organizationUnitId IS passed to findContractsForOrganization', async () => {
    const deps = makeBaseDeps();
    const now = new Date();
    const past = new Date(now.getTime() - 86400_000);
    const future = new Date(now.getTime() + 86400_000);
    deps.contractService.findContractsForOrganization.mockResolvedValue([
      {
        id: 'contract-active',
        contractStatus: 'ACTIVE',
        periodStart: past,
        periodEnd: future,
        organizationUnitId: 'ou-1',
      },
    ]);
    const service = makeService(deps);

    const result = await service.resolveAgreement({
      volunteerId: 'v-1',
      organizationUnitId: 'ou-1',
      shiftInstanceId: 'si-1',
      callerUserId: 'caller-1',
    });

    expect(result.status).toBe(AgreementStatus.ACTIVE);
    expect(result.contractId).toBe('contract-active');
    expect(result.reimbursementTypeName).toBe('Ehrenamtspauschale');
    expect(result.canManageAgreements).toBe(false);
    expect(result.managerNames).toEqual([]);
    // Verify organizationUnitId was passed in the filter (#1, #2).
    expect(
      deps.contractService.findContractsForOrganization,
    ).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ organizationUnitId: 'ou-1' }),
    );
    expect(deps.authService.hasRequiredPermissions).not.toHaveBeenCalled();
    expect(deps.authService.findUsersWithPermission).not.toHaveBeenCalled();
  });

  it('returns NO_TEMPLATE with permissions computed; managerNames proves filter-before-slice (4 users, first name null → 3 non-null names)', async () => {
    const deps = makeBaseDeps();
    deps.contractService.findContractsForOrganization.mockResolvedValue([]);
    // Simulate no template by throwing NotFound.
    deps.documentTemplateService.findActiveTemplate.mockRejectedValue(
      new NotFoundGraphQLError('no template'),
    );
    deps.authService.hasRequiredPermissions.mockResolvedValue(true);
    // 4 users: first has null name. Without filter-before-slice the null
    // would count toward the 3-name cap and Alice/Charlie/Diana would be the
    // result; with filter-before-slice null is removed first, so Alice,
    // Charlie, Diana are the three valid names.
    deps.authService.findUsersWithPermission.mockResolvedValue([
      { id: 'u1', name: null },
      { id: 'u2', name: 'Alice' },
      { id: 'u3', name: 'Charlie' },
      { id: 'u4', name: 'Diana' },
    ]);
    const service = makeService(deps);

    const result = await service.resolveAgreement({
      volunteerId: 'v-1',
      organizationUnitId: 'ou-1',
      shiftInstanceId: 'si-1',
      callerUserId: 'caller-1',
    });

    expect(result.status).toBe(AgreementStatus.NO_TEMPLATE);
    expect(result.canManageAgreements).toBe(true);
    // Null filtered first → 3 non-null names from the 4 users (#3).
    expect(result.managerNames).toEqual(['Alice', 'Charlie', 'Diana']);
    expect(deps.authService.hasRequiredPermissions).toHaveBeenCalledTimes(1);
    expect(deps.authService.findUsersWithPermission).toHaveBeenCalledTimes(1);
  });

  it('returns AWAITING_COUNTERSIGNATURE with contractId when a contract awaiting NGO signature exists', async () => {
    const deps = makeBaseDeps();
    deps.contractService.findContractsForOrganization.mockResolvedValue([
      { id: 'contract-ngo', contractStatus: 'AWAITING_NGO_SIGNATURE' },
    ]);
    // findActiveTemplate resolves (template exists).
    deps.documentTemplateService.findActiveTemplate.mockResolvedValue({
      id: 'tpl-1',
    });
    deps.authService.hasRequiredPermissions.mockResolvedValue(false);
    deps.authService.findUsersWithPermission.mockResolvedValue([]);
    const service = makeService(deps);

    const result = await service.resolveAgreement({
      volunteerId: 'v-1',
      organizationUnitId: 'ou-1',
      shiftInstanceId: 'si-1',
      callerUserId: 'caller-1',
    });

    expect(result.status).toBe(AgreementStatus.AWAITING_COUNTERSIGNATURE);
    expect(result.contractId).toBe('contract-ngo');
  });

  it('returns AWAITING_VOLUNTEER_SIGNATURE with contractId when only a volunteer-signature contract exists', async () => {
    const deps = makeBaseDeps();
    deps.contractService.findContractsForOrganization.mockResolvedValue([
      { id: 'contract-vol', contractStatus: 'AWAITING_VOLUNTEER_SIGNATURE' },
    ]);
    deps.documentTemplateService.findActiveTemplate.mockResolvedValue({
      id: 'tpl-1',
    });
    deps.authService.hasRequiredPermissions.mockResolvedValue(false);
    deps.authService.findUsersWithPermission.mockResolvedValue([]);
    const service = makeService(deps);

    const result = await service.resolveAgreement({
      volunteerId: 'v-1',
      organizationUnitId: 'ou-1',
      shiftInstanceId: 'si-1',
      callerUserId: 'caller-1',
    });

    expect(result.status).toBe(AgreementStatus.AWAITING_VOLUNTEER_SIGNATURE);
    expect(result.contractId).toBe('contract-vol');
  });

  it('returns NO_CONTRACT when a template exists but no matching contract is found', async () => {
    const deps = makeBaseDeps();
    deps.contractService.findContractsForOrganization.mockResolvedValue([]);
    deps.documentTemplateService.findActiveTemplate.mockResolvedValue({
      id: 'tpl-1',
    });
    deps.authService.hasRequiredPermissions.mockResolvedValue(false);
    deps.authService.findUsersWithPermission.mockResolvedValue([]);
    const service = makeService(deps);

    const result = await service.resolveAgreement({
      volunteerId: 'v-1',
      organizationUnitId: 'ou-1',
      shiftInstanceId: 'si-1',
      callerUserId: 'caller-1',
    });

    expect(result.status).toBe(AgreementStatus.NO_CONTRACT);
    expect(result.contractId).toBeNull();
  });
});
