import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AuthService } from '../../auth/auth.service';
import { PERMISSIONS, type Permission } from '../../auth/constants';
import { ForbiddenGraphQLError } from '../../graphql/errors';
import { OrganizationUnitAutomationKind } from '../enums';
import { UpdateOrganizationUnitAutomationInput } from '../inputs/update-organization-unit-automation.input';
import { OrganizationUnitAutomation } from '../models/organization-unit-automation.model';
import { OrganizationUnitAutomationService } from '../organization-unit-automation.service';

@Resolver(() => OrganizationUnitAutomation)
export class OrganizationUnitAutomationResolver {
  constructor(
    private readonly automationService: OrganizationUnitAutomationService,
    private readonly authService: AuthService,
  ) {}

  @Query(() => [OrganizationUnitAutomation])
  async organizationUnitAutomations(
    @Args('organizationUnitId', { type: () => ID }) organizationUnitId: string,
    @Session() session: UserSession,
  ): Promise<OrganizationUnitAutomation[]> {
    await this.assertPermission(
      session.user.id,
      organizationUnitId,
      PERMISSIONS.ORG_VIEW,
    );
    return this.automationService.findByUnitId(organizationUnitId);
  }

  @Mutation(() => OrganizationUnitAutomation)
  async updateOrganizationUnitAutomation(
    @Args('organizationUnitId', { type: () => ID }) organizationUnitId: string,
    @Args('kind', { type: () => OrganizationUnitAutomationKind })
    kind: OrganizationUnitAutomationKind,
    @Args('input') input: UpdateOrganizationUnitAutomationInput,
    @Session() session: UserSession,
  ): Promise<OrganizationUnitAutomation> {
    await this.assertPermission(
      session.user.id,
      organizationUnitId,
      PERMISSIONS.ORG_EDIT,
    );
    return this.automationService.update(organizationUnitId, kind, input);
  }

  private async assertPermission(
    userId: string,
    organizationUnitId: string,
    permission: Permission,
  ): Promise<void> {
    const allowed = await this.authService.hasRequiredPermissions(
      userId,
      organizationUnitId,
      [permission],
    );
    if (!allowed) {
      throw new ForbiddenGraphQLError(
        'You do not have permission to manage automations for this organization unit',
      );
    }
  }
}
