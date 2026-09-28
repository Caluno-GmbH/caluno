import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AuthService } from '../../auth/auth.service';
import { PERMISSIONS } from '../../auth/constants';
import type { UserEntity } from '../../auth/schemas/auth.schema';
import { OrganizationUnitDataService } from '../../organization/organization-unit-data.service';
import type { User } from '../../user/models/user.model';
import { UserService } from '../../user/user.service';
import {
  adminContactFromUser,
  hasConfiguredOrgUnitContact,
  orgUnitContactFromEntity,
} from '../membership-request-contact';
import { MembershipRequest } from '../models/membership-request.model';
import { MembershipRequestContact } from '../models/membership-request-contact.model';
import type { MembershipRequestEntity } from '../schemas/membership-request.schema';

type MembershipRequestParent = MembershipRequestEntity & {
  reviewedBy?: User | UserEntity | null;
  organizationUnit?: { id: string } | null;
};

@Resolver(() => MembershipRequest)
export class MembershipRequestFieldResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
  ) {}

  @ResolveField(() => MembershipRequestContact, { nullable: true })
  async contact(
    @Parent() request: MembershipRequestParent,
  ): Promise<MembershipRequestContact | null> {
    const organizationUnitId = request.organizationUnit?.id;
    if (!organizationUnitId) {
      return null;
    }

    const organizationUnit =
      await this.organizationUnitDataService.findById(organizationUnitId);

    if (organizationUnit && hasConfiguredOrgUnitContact(organizationUnit)) {
      return orgUnitContactFromEntity(organizationUnit);
    }

    const admins = await this.authService.findUsersWithPermission(
      organizationUnitId,
      PERMISSIONS.VOLUNTEER_EDIT,
    );

    const firstAdmin = admins[0];
    if (!firstAdmin) {
      return null;
    }

    const user = await this.userService.findById(firstAdmin.id);
    if (!user) {
      return null;
    }

    return adminContactFromUser(user);
  }
}
