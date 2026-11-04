import { Args, Context, ID, Mutation, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { TenantScopeService } from '../../organization/tenant-scope.service';
import { AuthService } from '../auth.service';
import { PERMISSIONS } from '../constants';
import { Permissions } from '../decorators/permissions.decorator';
import { CreateRoleInput } from '../inputs/create-role.input';
import { RoleMapper } from '../mappers/role.mapper';
import { Role } from '../models/role.model';

@Resolver(() => Role)
export class RoleMutationResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly roleMapper: RoleMapper,
    private readonly tenantScope: TenantScopeService,
  ) {}

  /** Roles are organization-wide, so only the top unit may manage them. */
  private assertTopUnit(context: AuthenticatedGraphQLContext): Promise<void> {
    return this.tenantScope.assertHeaderUnitIsTopUnit(
      context.organizationUnitId,
      'Roles can only be managed from the top unit',
    );
  }

  @Permissions(PERMISSIONS.ROLE_MANAGE)
  @Mutation(() => Role)
  async createRole(
    @Context() context: AuthenticatedGraphQLContext,
    @Session() session: UserSession,
    @Args('input') input: CreateRoleInput,
  ): Promise<Role> {
    await this.assertTopUnit(context);
    const role = await this.authService.createRole(
      context.organizationUnitId,
      input,
      session.user.id,
    );
    return this.roleMapper.toModelOrThrow(role);
  }

  @Permissions(PERMISSIONS.ROLE_MANAGE)
  @Mutation(() => Role)
  async updateRole(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CreateRoleInput,
    @Context() context: AuthenticatedGraphQLContext,
    @Session() session: UserSession,
  ): Promise<Role> {
    await this.assertTopUnit(context);
    const updatedRole = await this.authService.updateRole(
      context.organizationUnitId,
      id,
      input,
      session.user.id,
    );
    return this.roleMapper.toModelOrThrow(updatedRole);
  }

  @Permissions(PERMISSIONS.ROLE_MANAGE)
  @Mutation(() => Role)
  async deleteRole(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: AuthenticatedGraphQLContext,
    @Session() session: UserSession,
  ): Promise<Role> {
    await this.assertTopUnit(context);
    const deletedRole = await this.authService.deleteRole(
      context.organizationUnitId,
      id,
      session.user.id,
    );
    return this.roleMapper.toModelOrThrow(deletedRole);
  }
}
