import { Inject, Injectable } from '@nestjs/common';
import { ContractStatus, DocumentKind } from '../accounting/enums';
import { ContractService } from '../accounting/services/contract.service';
import { DocumentTemplateService } from '../accounting/services/document-template.service';
import { AuthService } from '../auth/auth.service';
import { PERMISSIONS } from '../auth/constants';
import type { Database } from '../database/database.module';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NotFoundGraphQLError } from '../graphql/errors';
import { OrganizationUnitDataService } from '../organization/organization-unit-data.service';
import { ShiftService } from '../shift/shift.service';
import { resolveEffectiveReimbursementTypeId } from '../shift/utils/effective-reimbursement-type';
import { AgreementStatus } from './agreement-status.enum';
import { CheckInAgreement } from './check-in-agreement.model';
import { reimbursementTypeLabel } from './reimbursement-type-labels';

@Injectable()
export class AgreementStatusService {
  constructor(
    private readonly shiftService: ShiftService,
    private readonly contractService: ContractService,
    private readonly documentTemplateService: DocumentTemplateService,
    private readonly authService: AuthService,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async resolve(params: {
    volunteerId: string;
    organizationUnitId: string;
    shiftInstanceId: string | null;
    callerUserId: string;
  }): Promise<CheckInAgreement> {
    const { volunteerId, organizationUnitId, shiftInstanceId, callerUserId } =
      params;

    // No shift instance → no reimbursement type context → not applicable.
    if (!shiftInstanceId) {
      return this.buildResult(
        AgreementStatus.NOT_APPLICABLE,
        null,
        null,
        false,
        [],
      );
    }

    const instance = await this.shiftService.findInstanceById(
      shiftInstanceId,
      organizationUnitId,
    );
    const typeId = resolveEffectiveReimbursementTypeId(
      instance.overrideReimbursementTypeId,
      instance.master.reimbursementTypeId,
    );

    // No reimbursement type → agreement does not apply.
    if (!typeId) {
      return this.buildResult(
        AgreementStatus.NOT_APPLICABLE,
        null,
        null,
        false,
        [],
      );
    }

    // Direct DB read — ReimbursementRateService is not exported from AccountingModule.
    const typeRow = await this.db.query.reimbursementTypes.findFirst({
      where: { id: typeId },
      columns: { key: true },
    });
    const reimbursementTypeName = typeRow
      ? reimbursementTypeLabel(typeRow.key)
      : null;

    const org =
      await this.organizationUnitDataService.findOrganizationByUnitId(
        organizationUnitId,
      );
    if (!org) {
      return this.buildResult(
        AgreementStatus.NOT_APPLICABLE,
        reimbursementTypeName,
        null,
        false,
        [],
      );
    }

    // Contract and template checks run in parallel.
    // Scoping to organizationUnitId: agreement is unit-scoped.
    const now = new Date();
    const [contracts, templateExists] = await Promise.all([
      this.contractService.findContractsForOrganization(org.id, {
        volunteerId,
        reimbursementTypeId: typeId,
        organizationUnitId,
      }),
      this.documentTemplateService
        .findActiveTemplate(
          org.id,
          typeId,
          DocumentKind.CONTRACT,
          organizationUnitId,
        )
        .then(() => true)
        .catch((err: unknown) => {
          // findActiveTemplate throws when absent; we only need presence.
          if (err instanceof NotFoundGraphQLError) return false;
          throw err;
        }),
    ]);

    // Only ACTIVE + period covers now satisfies the requirement.
    // Declined, expired, draft, or future-active fall through to NO_CONTRACT.
    let status: AgreementStatus;
    let contractId: string | null = null;

    const activeNow = contracts.find(
      (c) =>
        c.contractStatus === ContractStatus.ACTIVE &&
        c.periodStart <= now &&
        c.periodEnd >= now,
    );
    if (activeNow) {
      // Active → skip permission lookup.
      return this.buildResult(
        AgreementStatus.ACTIVE,
        reimbursementTypeName,
        activeNow.id,
        false,
        [],
      );
    }

    if (!templateExists) {
      status = AgreementStatus.NO_TEMPLATE;
    } else {
      // AWAITING_NGO_SIGNATURE takes priority over AWAITING_VOLUNTEER_SIGNATURE.
      const awaitingNgo = contracts.find(
        (c) => c.contractStatus === ContractStatus.AWAITING_NGO_SIGNATURE,
      );
      if (awaitingNgo) {
        status = AgreementStatus.AWAITING_COUNTERSIGNATURE;
        contractId = awaitingNgo.id;
      } else {
        const awaitingVol = contracts.find(
          (c) =>
            c.contractStatus === ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
        );
        if (awaitingVol) {
          status = AgreementStatus.AWAITING_VOLUNTEER_SIGNATURE;
          contractId = awaitingVol.id;
        } else {
          status = AgreementStatus.NO_CONTRACT;
        }
      }
    }

    // Permission lookup only for actionable states; ACTIVE/NOT_APPLICABLE returned early.
    const [canManageAgreements, permissionUsers] = await Promise.all([
      this.authService.hasRequiredPermissions(
        callerUserId,
        organizationUnitId,
        [PERMISSIONS.ACCOUNTING_MANAGE],
      ),
      this.authService.findUsersWithPermission(
        organizationUnitId,
        PERMISSIONS.ACCOUNTING_MANAGE,
      ),
    ]);

    // Filter nulls before capping so the limit applies to valid names only.
    const managerNames = permissionUsers
      .map((u) => u.name)
      .filter((n): n is string => n != null)
      .slice(0, 3);

    return this.buildResult(
      status,
      reimbursementTypeName,
      contractId,
      canManageAgreements,
      managerNames,
    );
  }

  private buildResult(
    status: AgreementStatus,
    reimbursementTypeName: string | null,
    contractId: string | null,
    canManageAgreements: boolean,
    managerNames: string[],
  ): CheckInAgreement {
    const result = new CheckInAgreement();
    result.status = status;
    result.reimbursementTypeName = reimbursementTypeName;
    result.contractId = contractId;
    result.canManageAgreements = canManageAgreements;
    result.managerNames = managerNames;
    return result;
  }
}
