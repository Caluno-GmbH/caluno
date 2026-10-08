import { Inject, Injectable } from '@nestjs/common';
import { ContractStatus, DocumentKind } from '../accounting/enums';
import { ContractService } from '../accounting/services/contract.service';
import { DocumentTemplateService } from '../accounting/services/document-template.service';
import { PERMISSIONS } from '../auth/constants';
import { AuthService } from '../auth/auth.service';
import { NotFoundGraphQLError } from '../graphql/errors';
import { OrganizationUnitDataService } from '../organization/organization-unit-data.service';
import { ShiftService } from '../shift/shift.service';
import { resolveEffectiveReimbursementTypeId } from '../shift/utils/effective-reimbursement-type';
import type { Database } from '../database/database.module';
import { DATABASE_CONNECTION } from '../database/database-connection';
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

    // Without a shift instance there is no reimbursement type context, so
    // agreement status is not applicable.
    if (!shiftInstanceId) {
      return this.buildResult(AgreementStatus.NOT_APPLICABLE, null, null, false, []);
    }

    // Resolve the shift instance and derive the effective reimbursement type.
    const instance = await this.shiftService.findInstanceById(
      shiftInstanceId,
      organizationUnitId,
    );
    const typeId = resolveEffectiveReimbursementTypeId(
      instance.overrideReimbursementTypeId,
      instance.master.reimbursementTypeId,
    );

    // Without a reimbursement type the agreement concept does not apply.
    if (!typeId) {
      return this.buildResult(AgreementStatus.NOT_APPLICABLE, null, null, false, []);
    }

    // Resolve the display name for the reimbursement type from the database
    // (ReimbursementRateService is not exported from AccountingModule).
    const typeRow = await this.db.query.reimbursementTypes.findFirst({
      where: { id: typeId },
      columns: { key: true },
    });
    const reimbursementTypeName = typeRow
      ? reimbursementTypeLabel(typeRow.key)
      : null;

    // Resolve the parent organization for contract and template lookups.
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

    // Fetch all contracts for this volunteer/type/unit in parallel with the
    // template check. Scoping contracts to organizationUnitId here satisfies
    // the requirement that check-in agreement is unit-scoped (#1, #2).
    const now = new Date();
    const [contracts, templateExists] = await Promise.all([
      this.contractService.findContractsForOrganization(org.id, {
        volunteerId,
        reimbursementTypeId: typeId,
        organizationUnitId,
      }),
      this.documentTemplateService
        .findActiveTemplate(org.id, typeId, DocumentKind.CONTRACT, organizationUnitId)
        .then(() => true)
        .catch((err: unknown) => {
          if (err instanceof NotFoundGraphQLError) return false;
          throw err;
        }),
    ]);

    // Classify contracts. An ACTIVE contract whose period covers now is the
    // only state that satisfies the agreement requirement. Declined, expired,
    // draft, or future-active contracts fall through to the next checks.
    let status: AgreementStatus;
    let contractId: string | null = null;

    const activeNow = contracts.find(
      (c) =>
        c.contractStatus === ContractStatus.ACTIVE &&
        c.periodStart <= now &&
        c.periodEnd >= now,
    );
    if (activeNow) {
      // Active contract found — no permission lookup needed.
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
      // AWAITING_NGO_SIGNATURE (countersign) takes priority over
      // AWAITING_VOLUNTEER_SIGNATURE.
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

    // Permission lookups are only relevant for actionable agreement states
    // (those where the manager can take action or the UI needs to show contact
    // details). NOT_APPLICABLE and ACTIVE skip this to avoid unnecessary DB
    // round-trips on every check-in readiness query (#8).
    const [canManageAgreements, permissionUsers] = await Promise.all([
      this.authService.hasRequiredPermissions(callerUserId, organizationUnitId, [
        PERMISSIONS.ACCOUNTING_MANAGE,
      ]),
      this.authService.findUsersWithPermission(
        organizationUnitId,
        PERMISSIONS.ACCOUNTING_MANAGE,
      ),
    ]);

    // Filter out users without a name first, then cap at 3 — filter-before-slice
    // ensures the cap applies to valid names only (#3).
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
