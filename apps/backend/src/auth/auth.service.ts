import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { Database, DbTransaction } from '../database/database.module';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as schema from '../database/schema';
import {
  OrganizationEntity,
  PermissionEntity,
  RoleEntity,
  UserEntity,
} from '../database/schema';
import {
  ConflictGraphQLError,
  ForbiddenGraphQLError,
  NotFoundGraphQLError,
} from '../graphql/errors';
import { OrganizationUnitDataService } from '../organization/organization-unit-data.service';
import { TenantScopeService } from '../organization/tenant-scope.service';
import {
  POSTHOG_EVENT,
  POSTHOG_SURFACE,
} from '../shared/observability/posthog.events';
import { PostHogService } from '../shared/observability/posthog.service';
import { isUniqueConstraintViolation } from '../utils/constraint-violation.util';
import { DEFAULT_OWNER_ROLE_NAME } from './constants';
import { PERMISSION_GROUPS } from './constants/permission-groups';
import { CreateRoleInput } from './inputs/create-role.input';
import { UpdateRoleInput } from './inputs/update-role.input';

type DbExecutor = Pick<Database, 'query'>;

const UNIQUE_ROLE_NAME_PER_ORG_CONSTRAINT =
  'uq_roles_name_organization_unit_id';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
    private readonly postHogService: PostHogService,
    private readonly tenantScope: TenantScopeService,
  ) {}

  async createRole(
    organizationUnitId: string,
    input: CreateRoleInput,
    userId: string,
  ): Promise<RoleEntity> {
    const organization = await this.getOrganization(organizationUnitId);
    await this.assertCanGrantPermissions(
      userId,
      organizationUnitId,
      input.permissionIds,
    );

    let role: RoleEntity;
    try {
      const [insertedRole] = await this.db
        .insert(schema.roles)
        .values({
          name: input.name,
          description: input.description,
          organizationId: organization.id,
        })
        .returning();

      if (!insertedRole) {
        throw new Error('Failed to create organization unit role');
      }

      role = insertedRole;
    } catch (error) {
      if (
        isUniqueConstraintViolation(error, UNIQUE_ROLE_NAME_PER_ORG_CONSTRAINT)
      ) {
        throw new ConflictGraphQLError(
          `A role named "${input.name}" already exists in this organization`,
        );
      }

      throw error;
    }

    if (input.permissionIds.length) {
      await this.db.insert(schema.rolePermissions).values(
        input.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      );
    }

    this.postHogService.capture({
      event: POSTHOG_EVENT.ROLE_CREATE,
      userId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: role.organizationId,
        organization_unit_id: organizationUnitId,
      },
    });

    return role;
  }

  async findUserPermissions(
    userId: string,
    organizationUnitId: string,
  ): Promise<PermissionEntity[]> {
    const ancestorUnitIds =
      await this.organizationUnitDataService.listInclusiveAncestorUnitIds(
        organizationUnitId,
      );

    if (ancestorUnitIds.length === 0) {
      return [];
    }

    return this.db
      .selectDistinct({
        id: schema.permissions.id,
        key: schema.permissions.key,
        description: schema.permissions.description,
        createdAt: schema.permissions.createdAt,
        updatedAt: schema.permissions.updatedAt,
      })
      .from(schema.permissions)
      .innerJoin(
        schema.rolePermissions,
        eq(schema.rolePermissions.permissionId, schema.permissions.id),
      )
      .innerJoin(
        schema.membershipRoles,
        eq(schema.membershipRoles.roleId, schema.rolePermissions.roleId),
      )
      .innerJoin(
        schema.memberships,
        eq(schema.memberships.id, schema.membershipRoles.membershipId),
      )
      .where(
        and(
          eq(schema.memberships.userId, userId),
          inArray(schema.memberships.organizationUnitId, ancestorUnitIds),
        ),
      );
  }

  async findUserPermissionKeys(
    userId: string,
    organizationUnitId: string,
  ): Promise<Set<string>> {
    const ancestorUnitIds =
      await this.organizationUnitDataService.listInclusiveAncestorUnitIds(
        organizationUnitId,
      );

    if (ancestorUnitIds.length === 0) {
      return new Set();
    }

    const rows = await this.db
      .selectDistinct({ key: schema.permissions.key })
      .from(schema.permissions)
      .innerJoin(
        schema.rolePermissions,
        eq(schema.rolePermissions.permissionId, schema.permissions.id),
      )
      .innerJoin(
        schema.membershipRoles,
        eq(schema.membershipRoles.roleId, schema.rolePermissions.roleId),
      )
      .innerJoin(
        schema.memberships,
        eq(schema.memberships.id, schema.membershipRoles.membershipId),
      )
      .where(
        and(
          eq(schema.memberships.userId, userId),
          inArray(schema.memberships.organizationUnitId, ancestorUnitIds),
        ),
      );

    return new Set(rows.map((r) => r.key));
  }

  async findUsersWithPermission(
    organizationUnitId: string,
    permissionKey: string,
  ): Promise<Array<Pick<UserEntity, 'id' | 'email' | 'name'>>> {
    const ancestorUnitIds =
      await this.organizationUnitDataService.listInclusiveAncestorUnitIds(
        organizationUnitId,
      );

    if (ancestorUnitIds.length === 0) {
      return [];
    }

    return this.db
      .selectDistinct({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
      })
      .from(schema.users)
      .innerJoin(
        schema.memberships,
        eq(schema.memberships.userId, schema.users.id),
      )
      .innerJoin(
        schema.membershipRoles,
        eq(schema.membershipRoles.membershipId, schema.memberships.id),
      )
      .innerJoin(
        schema.rolePermissions,
        eq(schema.rolePermissions.roleId, schema.membershipRoles.roleId),
      )
      .innerJoin(
        schema.permissions,
        eq(schema.permissions.id, schema.rolePermissions.permissionId),
      )
      .where(
        and(
          inArray(schema.memberships.organizationUnitId, ancestorUnitIds),
          eq(schema.permissions.key, permissionKey),
        ),
      );
  }

  async hasRequiredPermissions(
    userId: string,
    organizationUnitId: string,
    requiredPermissions: string[],
  ): Promise<boolean> {
    if (requiredPermissions.length === 0) {
      return true;
    }

    const permissionKeys = await this.findUserPermissionKeys(
      userId,
      organizationUnitId,
    );

    return requiredPermissions.every((permission) =>
      permissionKeys.has(permission),
    );
  }

  async findAllPermissions(): Promise<PermissionEntity[]> {
    return await this.db.query.permissions.findMany();
  }

  async findPermissionGroups(): Promise<
    Array<{
      key: string;
      label: string;
      items: Array<{ label: string; permission: PermissionEntity }>;
    }>
  > {
    const permissions = await this.findAllPermissions();
    const permissionsByKey = new Map(
      permissions.map((permission) => [permission.key, permission]),
    );

    return PERMISSION_GROUPS.map((group) => ({
      key: group.key,
      label: group.label,
      items: group.permissions.map((item) => {
        const permission = permissionsByKey.get(item.key);
        if (!permission) {
          throw new Error(`Missing permission definition for ${item.key}`);
        }

        return {
          label: item.label,
          permission,
        };
      }),
    }));
  }

  async findAllRoles(organizationUnitId: string): Promise<RoleEntity[]> {
    const organization = await this.getOrganization(organizationUnitId);

    return this.db.query.roles.findMany({
      where: { organizationId: organization.id },
      with: {
        permissions: {
          with: {
            permission: true,
          },
        },
      },
    });
  }

  /**
   * Throws Forbidden with `message` when the caller lacks any of `keys` in
   * this unit. Shared by role editing and role assignment.
   */
  private async assertHoldsPermissionKeys(
    userId: string,
    organizationUnitId: string,
    keys: Iterable<string>,
    message: string,
  ): Promise<void> {
    const callerKeys = await this.findUserPermissionKeys(
      userId,
      organizationUnitId,
    );
    const missing = [...new Set(keys)].filter((key) => !callerKeys.has(key));
    if (missing.length > 0) {
      throw new ForbiddenGraphQLError(`${message}: ${missing.join(', ')}`);
    }
  }

  /**
   * Rejects permission ids the caller does not hold in this unit, so a role
   * editor cannot escalate a role beyond their own permissions.
   */
  private async assertCanGrantPermissions(
    userId: string,
    organizationUnitId: string,
    permissionIds: string[],
  ): Promise<void> {
    const requestedIds = [...new Set(permissionIds)];
    if (requestedIds.length === 0) {
      return;
    }

    const requested = await this.db.query.permissions.findMany({
      where: { id: { in: requestedIds } },
    });
    if (requested.length !== requestedIds.length) {
      throw new NotFoundGraphQLError('Permission not found');
    }

    await this.assertHoldsPermissionKeys(
      userId,
      organizationUnitId,
      requested.map((p) => p.key),
      'You cannot grant or remove permissions you do not hold',
    );
  }

  /**
   * Loads a role by id and proves it belongs to the header unit's
   * organization. A foreign role looks like a missing one.
   */
  private async findRoleInScope(
    organizationUnitId: string,
    roleId: string,
    executor: DbExecutor = this.db,
  ): Promise<RoleEntity> {
    const role = await executor.query.roles.findFirst({
      where: { id: roleId },
    });
    if (!role) {
      throw new NotFoundGraphQLError('Role not found');
    }
    await this.tenantScope.assertOrganizationInScope(
      organizationUnitId,
      role.organizationId,
      'Role not found',
    );
    return role;
  }

  /**
   * Rejects roles that hold any permission the caller lacks in this unit, so
   * a volunteer editor cannot assign or take away roles above their own.
   */
  async assertCanAssignRoles(
    userId: string,
    organizationUnitId: string,
    roleIds: string[],
    executor: DbExecutor = this.db,
  ): Promise<void> {
    if (roleIds.length === 0) {
      return;
    }

    const rolePermissions = await executor.query.rolePermissions.findMany({
      where: { roleId: { in: roleIds } },
      with: { permission: true },
    });
    await this.assertHoldsPermissionKeys(
      userId,
      organizationUnitId,
      rolePermissions.flatMap((rp) =>
        rp.permission ? [rp.permission.key] : [],
      ),
      'You cannot assign or remove roles with permissions you do not hold',
    );
  }

  private isOwnerRole(role: Pick<RoleEntity, 'isInternal' | 'name'>): boolean {
    return role.isInternal && role.name === DEFAULT_OWNER_ROLE_NAME;
  }

  /**
   * Rejects taking the Owner role away from `membershipId` (role change,
   * removal or leaving) when no other membership holds it in the same unit or
   * an ancestor unit. An Owner in a child unit cannot administer the parent,
   * so it must not satisfy the invariant for the parent — otherwise a sub-org
   * owner would let the root lose its last owner. Locks the holder rows so two
   * owners demoting each other at once cannot both pass.
   */
  async assertOwnerRemains(
    tx: DbTransaction,
    membershipId: string,
    organizationUnitId: string,
    removedRoles: RoleEntity[],
  ): Promise<void> {
    const ownerRole = removedRoles.find((role) => this.isOwnerRole(role));
    if (!ownerRole) {
      return;
    }

    const unitIds =
      await this.organizationUnitDataService.listInclusiveAncestorUnitIds(
        organizationUnitId,
      );
    const holders = await tx
      .select({ membershipId: schema.membershipRoles.membershipId })
      .from(schema.membershipRoles)
      .innerJoin(
        schema.memberships,
        eq(schema.memberships.id, schema.membershipRoles.membershipId),
      )
      .where(
        and(
          eq(schema.membershipRoles.roleId, ownerRole.id),
          inArray(schema.memberships.organizationUnitId, unitIds),
        ),
      )
      .orderBy(schema.membershipRoles.id)
      // Lock only the role assignments; locking the joined membership rows too
      // would deadlock two owners demoting each other (each already holds its
      // own membership row from the caller's SELECT ... FOR UPDATE).
      .for('update', { of: [schema.membershipRoles] });
    if (!holders.some((holder) => holder.membershipId !== membershipId)) {
      throw new ConflictGraphQLError(
        'An organization must keep at least one owner.',
      );
    }
  }

  async findRoleById(
    organizationUnitId: string,
    roleId: string,
  ): Promise<RoleEntity> {
    return this.findRoleInScope(organizationUnitId, roleId);
  }

  async findRolePermissions(roleId: string): Promise<PermissionEntity[]> {
    const rolePermissions = await this.db.query.rolePermissions.findMany({
      where: { roleId },
      with: {
        permission: true,
      },
    });

    return rolePermissions
      .map((rp) => rp.permission)
      .filter((p): p is PermissionEntity => p !== null);
  }

  async updateRole(
    organizationUnitId: string,
    roleId: string,
    input: UpdateRoleInput,
    userId: string,
  ): Promise<RoleEntity> {
    const updatedRole = await this.db.transaction(async (tx) => {
      const roleToUpdate = await this.findRoleInScope(
        organizationUnitId,
        roleId,
        tx,
      );

      if (roleToUpdate.isInternal) {
        throw new ForbiddenGraphQLError('Cannot modify internal roles');
      }

      if (input.permissionIds !== undefined) {
        // Added and removed permissions must be held by the caller. Unchanged
        // ones are not checked, so an editor can still rename a role.
        const current = await tx.query.rolePermissions.findMany({
          where: { roleId: roleToUpdate.id },
          columns: { permissionId: true },
        });
        const currentIds = new Set(current.map((rp) => rp.permissionId));
        const nextIds = new Set(input.permissionIds);
        await this.assertCanGrantPermissions(userId, organizationUnitId, [
          ...input.permissionIds.filter((id) => !currentIds.has(id)),
          ...[...currentIds].filter((id) => !nextIds.has(id)),
        ]);
      }

      const updateData: Partial<typeof schema.roles.$inferInsert> = {};
      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.description !== undefined) {
        updateData.description = input.description;
      }

      let role: RoleEntity;
      try {
        const [updated] = await tx
          .update(schema.roles)
          .set(updateData)
          .where(eq(schema.roles.id, roleToUpdate.id))
          .returning();

        if (!updated) {
          throw new NotFoundGraphQLError('Role not found');
        }

        role = updated;
      } catch (error) {
        if (
          isUniqueConstraintViolation(
            error,
            UNIQUE_ROLE_NAME_PER_ORG_CONSTRAINT,
          )
        ) {
          throw new ConflictGraphQLError(
            `A role named "${input.name}" already exists in this organization`,
          );
        }

        throw error;
      }

      if (input.permissionIds !== undefined) {
        await tx
          .delete(schema.rolePermissions)
          .where(eq(schema.rolePermissions.roleId, roleToUpdate.id));

        if (input.permissionIds.length) {
          await tx.insert(schema.rolePermissions).values(
            input.permissionIds.map((permissionId) => ({
              roleId: roleToUpdate.id,
              permissionId,
            })),
          );
        }
      }

      return role;
    });

    this.postHogService.capture({
      event: POSTHOG_EVENT.ROLE_UPDATE,
      userId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: updatedRole.organizationId,
      },
    });

    return updatedRole;
  }

  async deleteRole(
    organizationUnitId: string,
    roleId: string,
    userId: string,
  ): Promise<RoleEntity> {
    const deletedRole = await this.db.transaction(async (tx) => {
      const roleToDelete = await this.findRoleInScope(
        organizationUnitId,
        roleId,
        tx,
      );

      if (roleToDelete.isInternal) {
        throw new ForbiddenGraphQLError('Cannot delete internal roles');
      }

      // Deleting cascades to every membership holding the role, so it removes
      // all of its permissions from them. The caller must hold each of them.
      const granted = await tx.query.rolePermissions.findMany({
        where: { roleId: roleToDelete.id },
        columns: { permissionId: true },
      });
      await this.assertCanGrantPermissions(
        userId,
        organizationUnitId,
        granted.map((rp) => rp.permissionId),
      );

      const [role] = await tx
        .delete(schema.roles)
        .where(eq(schema.roles.id, roleToDelete.id))
        .returning();

      if (!role) {
        throw new NotFoundGraphQLError('Role not found');
      }

      return role;
    });

    this.postHogService.capture({
      event: POSTHOG_EVENT.ROLE_DELETE,
      userId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: deletedRole.organizationId,
      },
    });

    return deletedRole;
  }

  async getOrganization(
    organizationUnitId: string,
  ): Promise<OrganizationEntity> {
    const organization =
      await this.organizationUnitDataService.findOrganizationByUnitId(
        organizationUnitId,
      );

    if (!organization) {
      throw new NotFoundGraphQLError('Organization not found');
    }

    return organization;
  }
}
