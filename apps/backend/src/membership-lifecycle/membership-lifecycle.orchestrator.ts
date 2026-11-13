import { Injectable, Logger } from '@nestjs/common';
import { PERMISSIONS } from '../auth/constants';
import { EventService } from '../event/event.service';
import { ConflictGraphQLError, ForbiddenGraphQLError } from '../graphql/errors';
import { MembershipService } from '../membership/membership.service';
import type {
  MembershipRequestEntity,
  MembershipRequestMetadata,
} from '../membership/schemas/membership-request.schema';
import { OrganizationService } from '../organization/organization.service';
import { TenantScopeService } from '../organization/tenant-scope.service';
import { RequiredFormTargetType } from '../requirement-profile/enums';
import { SubmitFormInput } from '../requirement-profile/inputs/submit-form.input';
import type { FormSubmissionEntity } from '../requirement-profile/schemas/form-submission.schema';
import { FormSubmissionService } from '../requirement-profile/services/form-submission.service';
import { RequiredFormService } from '../requirement-profile/services/required-form.service';
import {
  POSTHOG_JOIN_SOURCE,
  type PostHogJoinSource,
} from '../shared/observability/posthog.events';
import { ShiftService } from '../shift/shift.service';

@Injectable()
export class MembershipLifecycleOrchestrator {
  private readonly logger = new Logger(MembershipLifecycleOrchestrator.name);

  constructor(
    private readonly membershipService: MembershipService,
    private readonly shiftService: ShiftService,
    private readonly eventService: EventService,
    private readonly formSubmissionService: FormSubmissionService,
    private readonly requiredFormService: RequiredFormService,
    private readonly organizationService: OrganizationService,
    private readonly tenantScopeService: TenantScopeService,
  ) {}

  async approveMembershipRequest(
    id: string,
    organizationUnitId: string,
    reviewerId: string,
    source: 'membership_approve' | 'check_in' = 'membership_approve',
  ): Promise<MembershipRequestEntity> {
    const membershipRequest =
      await this.membershipService.approveMembershipRequest(
        id,
        organizationUnitId,
        reviewerId,
        source,
      );

    await this.fulfillIntendedJoins(
      membershipRequest,
      source === 'check_in'
        ? POSTHOG_JOIN_SOURCE.CHECK_IN
        : POSTHOG_JOIN_SOURCE.MEMBERSHIP_APPROVE,
    );

    return membershipRequest;
  }

  /**
   * Check-in desk approval: the request may target the context unit or an
   * ancestor of it, and membership is granted in the request's own unit.
   * Authority model: a check-in desk may only grant membership in units it
   * manages, so the caller needs check-in:manage on the request's unit itself
   * — managing the selected child unit does not cover a parent's request.
   * Required forms of that unit are a hard gate.
   */
  async checkInApproveMembershipRequest(
    requestId: string,
    contextUnitId: string,
    reviewerId: string,
  ): Promise<MembershipRequestEntity> {
    const request =
      await this.membershipService.findPendingVolunteerRequestById(requestId);
    // A pending request to an ancestor counts for the selected unit; any other
    // unit's request is reported as not found, so its id is not confirmed.
    await this.tenantScopeService.assertResourceInAncestorScope(
      contextUnitId,
      request.organizationUnitId,
      'Membership request not found',
    );

    const canManageRequestUnit =
      await this.organizationService.hasPermissionInUnit(
        reviewerId,
        PERMISSIONS.CHECK_IN_MANAGE,
        request.organizationUnitId,
      );
    if (!canManageRequestUnit) {
      throw new ForbiddenGraphQLError(
        'Only a check-in manager of the requested unit can accept this request',
      );
    }

    const requiredFormsSatisfied =
      await this.requiredFormService.areRequiredFormsSatisfied(request.userId, {
        targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
        targetId: request.organizationUnitId,
      });
    if (!requiredFormsSatisfied) {
      throw new ConflictGraphQLError(
        'Cannot approve: required forms are not submitted.',
      );
    }

    return this.approveMembershipRequest(
      request.id,
      request.organizationUnitId,
      reviewerId,
      'check_in',
    );
  }

  async rejectMembershipRequest(
    id: string,
    organizationUnitId: string,
    reviewerId: string,
    rejectionReason: string,
  ): Promise<MembershipRequestEntity> {
    return this.membershipService.rejectMembershipRequest(
      id,
      organizationUnitId,
      reviewerId,
      rejectionReason,
    );
  }

  async submitForm(
    token: string,
    input: SubmitFormInput,
    userId: string,
    organizationUnitId: string,
  ): Promise<FormSubmissionEntity> {
    const submission = await this.formSubmissionService.submit(
      token,
      input,
      userId,
      organizationUnitId,
    );

    const isMember = await this.membershipService.isMemberOfUnitOrAncestor(
      userId,
      organizationUnitId,
    );
    if (!isMember) {
      const requiredFormsSatisfied =
        await this.requiredFormService.areRequiredFormsSatisfied(userId, {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: organizationUnitId,
        });
      if (requiredFormsSatisfied) {
        try {
          await this.membershipService.createMembershipRequest(
            userId,
            organizationUnitId,
          );
        } catch (e) {
          // Pending request already exists or transient error — submission is still valid
          this.logger.warn(
            '[FormSubmission] createMembershipRequest skipped',
            e,
          );
        }
      }
    }

    return submission;
  }

  private async fulfillIntendedJoins(
    membershipRequest: MembershipRequestEntity,
    joinSource: PostHogJoinSource,
  ): Promise<void> {
    const metadata = (membershipRequest.metadata ??
      {}) as MembershipRequestMetadata;

    if (!membershipRequest.userId) {
      return;
    }

    if (metadata.intendedShiftInstanceIds?.length) {
      for (const instanceId of metadata.intendedShiftInstanceIds) {
        try {
          await this.shiftService.findInstanceById(
            instanceId,
            membershipRequest.organizationUnitId,
          );
          await this.shiftService.joinShiftInstance(
            membershipRequest.userId,
            instanceId,
            { source: joinSource },
          );
        } catch (e) {
          this.logger.warn(
            `Failed to auto-join shift instance ${instanceId}: ${e}`,
          );
        }
      }
    }

    if (metadata.intendedShiftIds?.length) {
      for (const shiftId of metadata.intendedShiftIds) {
        try {
          await this.shiftService.joinShift(
            membershipRequest.userId,
            shiftId,
            joinSource,
          );
        } catch (e) {
          this.logger.warn(`Failed to auto-join shift ${shiftId}: ${e}`);
        }
      }
    }

    if (metadata.intendedEventIds?.length) {
      for (const eventId of metadata.intendedEventIds) {
        try {
          const event = await this.eventService.findByIdPublic(eventId);
          if (event) {
            await this.eventService.joinEvent(
              membershipRequest.userId,
              eventId,
              {
                source: joinSource,
              },
            );
          }
        } catch (e) {
          this.logger.warn(`Failed to auto-join event ${eventId}: ${e}`);
        }
      }
    }
  }
}
