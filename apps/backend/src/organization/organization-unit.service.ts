import { Inject, Injectable } from '@nestjs/common';
import { and, count, countDistinct, eq, gte, isNull } from 'drizzle-orm';
import {
  DEFAULT_MEMBER_ROLE_NAME,
  DEFAULT_OWNER_ROLE_NAME,
} from '../auth/constants';
import type { Database } from '../database/database.module';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as schema from '../database/schema';
import {
  BadRequestGraphQLError,
  ConflictGraphQLError,
  NotFoundGraphQLError,
} from '../graphql/errors';
import type { Locale } from '../graphql/locale';
import type { PaginationInput } from '../graphql/pagination.input';
import { AppI18nService } from '../i18n/app-i18n.service';
import { createEmailTemplateContext } from '../notification/email/email-template-context';
import { EmailCategory } from '../notification/email/outbox/email-outbox.enums';
import { EmailOutboxService } from '../notification/email/outbox/email-outbox.service';
import { organizationUnitDeletionRequestTemplate } from '../notification/email/templates/organization-unit-deletion-request.template';
import { emailTheme } from '../notification/email/templates/shared';
import {
  POSTHOG_EVENT,
  POSTHOG_SURFACE,
} from '../shared/observability/posthog.events';
import { PostHogService } from '../shared/observability/posthog.service';
import { startOfTodayInAppTimeZone } from '../shift/utils/app-time';
import { FilePurpose } from '../storage/enums';
import { FileService } from '../storage/services/file.service';
import { isBlank, slugify, trimmed } from '../utils';
import type { CreateOrganizationUnitInput } from './inputs/create-organization-unit.input';
import type { UpdateOrganizationUnitInput } from './inputs/update-organization-unit.input';
import { OrganizationUnitDataService } from './organization-unit-data.service';
import type { OrganizationEntity } from './schemas/organization.schema';
import type { OrganizationUnitEntity } from './schemas/organization-unit.schema';
import type { OrganizationUnitTypeEntity } from './schemas/organization-unit-type.schema';
import { TenantScopeService } from './tenant-scope.service';

@Injectable()
export class OrganizationUnitService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly fileService: FileService,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
    private readonly tenantScopeService: TenantScopeService,
    private readonly postHogService: PostHogService,
    private readonly emailOutbox: EmailOutboxService,
    private readonly appI18n: AppI18nService,
  ) {}

  async findById(id: string): Promise<OrganizationUnitEntity | undefined> {
    return this.organizationUnitDataService.findById(id);
  }

  async findBySlug(slug: string): Promise<OrganizationUnitEntity | undefined> {
    return this.db.query.organizationUnits.findFirst({
      where: { slug },
    });
  }

  async findAll(
    organizationId: string,
    pagination: PaginationInput,
  ): Promise<{ items: OrganizationUnitEntity[]; total: number }> {
    const items = await this.db.query.organizationUnits.findMany({
      where: { organizationId },
      limit: pagination.limit,
      offset: pagination.offset,
    });

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.organizationUnits)
      .where(
        and(
          eq(schema.organizationUnits.organizationId, organizationId),
          isNull(schema.organizationUnits.deletedAt),
        ),
      );

    return { items, total };
  }

  async findOrganization(
    organizationId: string,
  ): Promise<OrganizationEntity | undefined> {
    return this.db.query.organizations.findFirst({
      where: { id: organizationId },
    });
  }

  async findOrganizationByUnitId(
    organizationUnitId: string,
  ): Promise<OrganizationEntity | undefined> {
    return this.organizationUnitDataService.findOrganizationByUnitId(
      organizationUnitId,
    );
  }

  async findType(
    typeId: string,
    organizationId?: string,
  ): Promise<OrganizationUnitTypeEntity | undefined> {
    return this.db.query.organizationUnitTypes.findFirst({
      where: {
        id: typeId,
        ...(organizationId ? { organizationId } : {}),
      },
    });
  }

  async findOrganizationIdByUnitId(
    organizationUnitId: string,
  ): Promise<string | undefined> {
    return this.organizationUnitDataService.findOrganizationIdByUnitId(
      organizationUnitId,
    );
  }

  async findAllTypes(
    organizationId: string,
  ): Promise<OrganizationUnitTypeEntity[]> {
    return this.db.query.organizationUnitTypes.findMany({
      where: { organizationId },
    });
  }

  async findParent(
    parentId: string,
  ): Promise<OrganizationUnitEntity | undefined> {
    return this.db.query.organizationUnits.findFirst({
      where: { id: parentId },
    });
  }

  async findChildren(parentId: string): Promise<OrganizationUnitEntity[]> {
    return this.db
      .select()
      .from(schema.organizationUnits)
      .where(
        and(
          eq(schema.organizationUnits.parentId, parentId),
          isNull(schema.organizationUnits.deletedAt),
        ),
      );
  }

  async listInclusiveAncestorUnitIds(
    organizationUnitId: string,
  ): Promise<string[]> {
    return this.organizationUnitDataService.listInclusiveAncestorUnitIds(
      organizationUnitId,
    );
  }

  async create(
    userId: string,
    input: CreateOrganizationUnitInput,
    headerUnitId: string,
  ): Promise<OrganizationUnitEntity> {
    const name = trimmed(input.name);
    if (isBlank(name)) {
      throw new BadRequestGraphQLError('Organization unit name is required');
    }

    // Never trust input.organizationId / a foreign parentId: derive the org
    // from the header unit and require parent to sit in that unit's subtree.
    await this.tenantScopeService.assertResourceInScope(
      headerUnitId,
      input.parentId,
      'Parent organization unit not found',
    );
    const organizationId =
      await this.organizationUnitDataService.findOrganizationIdByUnitId(
        headerUnitId,
      );

    const type = await this.findType(input.typeId, organizationId);
    if (!type) {
      throw new NotFoundGraphQLError('Organization unit type not found');
    }

    const slug = slugify(name);
    const existing = await this.findBySlug(slug);
    if (existing) {
      throw new ConflictGraphQLError(
        `Organization unit slug "${slug}" already exists`,
      );
    }

    const {
      logoFileId,
      organizationId: _ignoredOrganizationId,
      ...unitInput
    } = input;
    const logoUrl = logoFileId ? await this.resolveLogoUrl(logoFileId) : null;

    const [organizationUnit] = await this.db.transaction(async (tx) => {
      const [unit] = await tx
        .insert(schema.organizationUnits)
        .values({
          ...unitInput,
          name,
          logoUrl,
          organizationId,
          slug,
        })
        .returning();

      await this.addMemberMembership(userId, unit.id, organizationId, tx);

      return [unit];
    });

    this.postHogService.capture({
      event: POSTHOG_EVENT.ORGANIZATION_UNIT_CREATE,
      userId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: organizationUnit.organizationId ?? undefined,
        organization_unit_id: organizationUnit.id,
      },
    });

    return organizationUnit;
  }

  async addOwnerMembership(
    userId: string,
    organizationUnitId: string,
    organizationId: string,
    tx?: Database,
  ): Promise<void> {
    await this.addMembershipWithRole(
      userId,
      organizationUnitId,
      organizationId,
      DEFAULT_OWNER_ROLE_NAME,
      tx,
    );
  }

  /**
   * Sub-org creators keep only the permissions they already inherit from the
   * parent unit. The local membership exists so an admin can later assign a
   * role to it; the internal Member role grants nothing.
   */
  async addMemberMembership(
    userId: string,
    organizationUnitId: string,
    organizationId: string,
    tx?: Database,
  ): Promise<void> {
    await this.addMembershipWithRole(
      userId,
      organizationUnitId,
      organizationId,
      DEFAULT_MEMBER_ROLE_NAME,
      tx,
    );
  }

  private async addMembershipWithRole(
    userId: string,
    organizationUnitId: string,
    organizationId: string,
    roleName: string,
    tx?: Database,
  ): Promise<void> {
    const db = tx ?? this.db;

    const role = await db.query.roles.findFirst({
      where: { organizationId, name: roleName, isInternal: true },
    });

    if (!role) throw new NotFoundGraphQLError(`${roleName} role not found`);

    const [membership] = await db
      .insert(schema.memberships)
      .values({ userId, organizationUnitId })
      .returning();

    await db.insert(schema.membershipRoles).values({
      membershipId: membership.id,
      roleId: role.id,
    });
  }

  async update(
    id: string,
    input: UpdateOrganizationUnitInput,
    userId: string,
    headerUnitId: string,
  ): Promise<OrganizationUnitEntity> {
    // Never trust a foreign id / input.organizationId: the target must sit in
    // the header unit's subtree, and the org is taken from the loaded unit.
    await this.tenantScopeService.assertResourceInScope(
      headerUnitId,
      id,
      'Organization unit not found',
    );

    const unit = await this.findById(id);

    if (!unit) {
      throw new NotFoundGraphQLError('Organization unit not found');
    }

    // Moving a unit changes the ancestor chain that authorization and data
    // scoping depend on. The UI never exposes it, so reject the field outright
    // instead of re-parenting a branch (or creating a cycle) from the API.
    if (input.parentId !== undefined) {
      throw new BadRequestGraphQLError('Organization units cannot be moved');
    }

    const name = input.name === undefined ? undefined : trimmed(input.name);
    if (name !== undefined && isBlank(name)) {
      throw new BadRequestGraphQLError('Organization unit name is required');
    }

    if (input.typeId) {
      const type = await this.findType(input.typeId, unit.organizationId);
      if (!type) {
        throw new NotFoundGraphQLError('Organization unit type not found');
      }
    }

    const {
      organizationId: _ignoredOrganizationId,
      logoFileId,
      ...rest
    } = input;
    const updateFields = name === undefined ? rest : { ...rest, name };

    const [updated] = await this.db
      .update(schema.organizationUnits)
      .set({
        ...updateFields,
        ...(logoFileId === undefined
          ? {}
          : {
              logoUrl: logoFileId
                ? await this.resolveLogoUrl(logoFileId)
                : null,
            }),
      })
      .where(
        and(
          eq(schema.organizationUnits.id, id),
          eq(schema.organizationUnits.organizationId, unit.organizationId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundGraphQLError('Organization unit not found');
    }

    if (updated.parentId === null && name !== undefined) {
      await this.db
        .update(schema.organizations)
        .set({ name: updated.name })
        .where(eq(schema.organizations.id, updated.organizationId));
    }

    this.postHogService.capture({
      event: POSTHOG_EVENT.ORGANIZATION_UNIT_UPDATE,
      userId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: updated.organizationId ?? undefined,
        organization_unit_id: updated.id,
      },
    });

    return updated;
  }

  private async resolveLogoUrl(logoFileId: string): Promise<string> {
    await this.fileService.assertUploadedFileForPurpose(
      logoFileId,
      FilePurpose.ORG_LOGO,
    );
    return this.fileService.resolvePublicUrlForUploadedFile(logoFileId);
  }

  async countMembers(organizationUnitId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(schema.memberships)
      .where(eq(schema.memberships.organizationUnitId, organizationUnitId));

    return row?.total ?? 0;
  }

  /**
   * Count of shifts under an org unit with at least one upcoming,
   * non-cancelled instance — a simple "still has capacity to sign up"
   * signal. Doesn't account for per-instance capacity being full.
   */
  async countOpenShifts(organizationUnitId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: countDistinct(schema.shifts.id) })
      .from(schema.shifts)
      .innerJoin(
        schema.shiftInstances,
        eq(schema.shiftInstances.masterId, schema.shifts.id),
      )
      .where(
        and(
          eq(schema.shifts.organizationUnitId, organizationUnitId),
          eq(schema.shifts.isDeleted, false),
          eq(schema.shiftInstances.isCancelled, false),
          gte(
            schema.shiftInstances.actualStartsAt,
            startOfTodayInAppTimeZone(),
          ),
        ),
      );

    return row?.total ?? 0;
  }

  async requestDeletion(
    id: string,
    requester: { name: string; email: string },
    message: string | undefined,
    locale: Locale,
    headerUnitId: string,
  ): Promise<OrganizationUnitEntity> {
    await this.tenantScopeService.assertResourceInScope(
      headerUnitId,
      id,
      'Organization unit not found',
    );

    const unit = await this.findById(id);

    if (!unit) {
      throw new NotFoundGraphQLError('Organization unit not found');
    }

    const organization = await this.findOrganization(unit.organizationId);

    const templateContext = createEmailTemplateContext(this.appI18n, locale);

    const { subject, html } = await organizationUnitDeletionRequestTemplate(
      {
        organizationUnitId: unit.id,
        organizationUnitName: unit.name,
        organizationName: organization?.name ?? '',
        requesterName: requester.name,
        requesterEmail: requester.email,
        message,
        requestedAt: new Date(),
      },
      templateContext,
    );

    await this.emailOutbox.enqueue({
      category: EmailCategory.SUPPORT,
      to: emailTheme.supportEmail,
      subject,
      html,
      organizationUnitId: unit.id,
    });

    return unit;
  }
}
