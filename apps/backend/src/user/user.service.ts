import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { UserEntity } from '../auth/schemas/auth.schema';
import type { Database } from '../database/database.module';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as schema from '../database/schema';
import {
  BadRequestGraphQLError,
  NotFoundGraphQLError,
} from '../graphql/errors';
import { type Locale, resolveRequestLocale } from '../graphql/locale';
import {
  formatSystemKeyLabel,
  validateSystemKeyValue,
} from '../requirement-profile/profile-validation';
import type { OrganizationUserProfileEntity } from '../requirement-profile/schemas/organization-user-profile.schema';
import {
  POSTHOG_EVENT,
  POSTHOG_SURFACE,
} from '../shared/observability/posthog.events';
import { PostHogService } from '../shared/observability/posthog.service';
import { isBlank, trimmed } from '../utils';
import {
  type ProfileFields,
  profileDataToUserColumns,
  toProfileDataMap,
  WRITABLE_PROFILE_SYSTEM_KEYS,
} from './profile-fields';
import { formatUserName } from './user-name';

@Injectable()
export class UserService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly postHogService: PostHogService,
  ) {}

  async findById(id: string): Promise<UserEntity | undefined> {
    return this.db.query.users.findFirst({
      where: { id },
    });
  }

  /**
   * Admin volunteer lookup: only when the target has a membership or
   * membership request in the given org unit (former adminUserProfile gate).
   */
  async findByIdInOrgUnit(
    userId: string,
    orgUnitId: string,
  ): Promise<UserEntity | undefined> {
    const isMember = await this.db.query.memberships.findFirst({
      where: { userId, organizationUnitId: orgUnitId },
      columns: { id: true },
    });
    const hasRequest = isMember
      ? null
      : await this.db.query.membershipRequests.findFirst({
          where: { userId, organizationUnitId: orgUnitId },
          columns: { id: true },
        });

    if (!isMember && !hasRequest) {
      return undefined;
    }
    return this.findById(userId);
  }

  async findByEmail(email: string): Promise<UserEntity | undefined> {
    return this.db.query.users.findFirst({
      where: { email },
    });
  }

  async findByCheckInId(checkInId: string): Promise<UserEntity | undefined> {
    return this.db.query.users.findFirst({
      where: { checkInId },
    });
  }

  async findByIds(ids: string[]): Promise<UserEntity[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.db.query.users.findMany({
      where: { id: { in: ids } },
    });
  }

  async findByIdOrThrow(id: string, tx?: Database): Promise<UserEntity> {
    const db = tx ?? this.db;
    const user = await db.query.users.findFirst({
      where: { id },
    });

    if (!user) {
      throw new NotFoundGraphQLError('User not found');
    }

    return user;
  }

  async getProfileDataByUserId(
    userId: string,
  ): Promise<Record<string, unknown>> {
    const user = await this.findById(userId);
    if (!user) {
      return {};
    }
    return toProfileDataMap(user);
  }

  /**
   * Merge profile fields from a systemKey → value map onto the user row.
   * Skips email. Validates writable system keys.
   */
  async updateProfileFields(
    userId: string,
    data: Record<string, unknown>,
    tx?: Database,
  ): Promise<UserEntity> {
    const columns = profileDataToUserColumns(data);

    for (const key of WRITABLE_PROFILE_SYSTEM_KEYS) {
      if (!Object.hasOwn(data, key)) continue;
      const value = data[key];
      if (typeof value !== 'string') continue;
      validateSystemKeyValue(value, key, formatSystemKeyLabel(key), null);
    }

    return this.applyProfileColumns(userId, columns, tx);
  }

  async updateMyProfile(
    userId: string,
    input: ProfileFields,
  ): Promise<UserEntity> {
    const data: Record<string, unknown> = {};
    const reverse: Record<string, string> = {
      firstname: 'firstname',
      lastname: 'lastname',
      preferredName: 'preferred-name',
      gender: 'gender',
      phone: 'phone',
      street: 'street',
      zip: 'zip',
      city: 'city',
      birthdate: 'birthdate',
      iban: 'iban',
      accountHolder: 'account-holder',
      bic: 'bic',
    };
    for (const [column, systemKey] of Object.entries(reverse)) {
      if (!Object.hasOwn(input, column)) continue;
      const value = input[column as keyof ProfileFields];
      if (value === undefined) continue;
      data[systemKey] = value;
    }
    return this.updateProfileFields(userId, data);
  }

  private async applyProfileColumns(
    userId: string,
    columns: ProfileFields,
    tx?: Database,
  ): Promise<UserEntity> {
    const db = tx ?? this.db;
    const changes: Record<string, string | null> = {};

    for (const [key, value] of Object.entries(columns)) {
      if (value === undefined) continue;
      if (key === 'firstname' || key === 'lastname') {
        const trimmedValue = trimmed(value);
        if (isBlank(trimmedValue))
          throw new BadRequestGraphQLError('First and last name are required');
        changes[key] = trimmedValue;
      } else {
        changes[key] = value;
      }
    }

    if (changes.firstname && changes.lastname) {
      changes.name = formatUserName(changes.firstname, changes.lastname);
    } else if (changes.firstname || changes.lastname) {
      const existing = await this.findByIdOrThrow(userId, db);
      const first = changes.firstname ? changes.firstname : existing.firstname;
      const last = changes.lastname ? changes.lastname : existing.lastname;
      changes.name = formatUserName(first, last);
    }

    if (Object.keys(changes).length === 0) {
      return await this.findByIdOrThrow(userId, db);
    }

    const [user] = await db
      .update(schema.users)
      .set(changes)
      .where(eq(schema.users.id, userId))
      .returning();

    if (!user) {
      throw new NotFoundGraphQLError('User not found');
    }

    if (!tx) {
      this.postHogService.capture({
        event: POSTHOG_EVENT.USER_PROFILE_UPDATE,
        userId,
        properties: {
          surface: POSTHOG_SURFACE.VOLUNTEERING,
        },
      });
    }

    return user;
  }

  async updateLocale(
    userId: string,
    locale: string,
  ): Promise<UserEntity | undefined> {
    const [user] = await this.db
      .update(schema.users)
      .set({ locale })
      .where(eq(schema.users.id, userId))
      .returning();
    if (user) {
      this.postHogService.capture({
        event: POSTHOG_EVENT.USER_UPDATE,
        userId,
        properties: {
          surface: POSTHOG_SURFACE.VOLUNTEERING,
          updated_field: 'locale',
        },
      });
    }
    return user;
  }

  async updateAccountSettings(
    userId: string,
    settings: {
      locale?: string;
      emailWeeklyUpdateEnabled?: boolean;
      emailUrgentCallsEnabled?: boolean;
      emailPlatformEnabled?: boolean;
    },
  ): Promise<UserEntity> {
    const changes: {
      locale?: string;
      emailWeeklyUpdateEnabled?: boolean;
      emailUrgentCallsEnabled?: boolean;
      emailPlatformEnabled?: boolean;
    } = {};
    if (settings.locale !== undefined) {
      changes.locale = settings.locale;
    }
    if (settings.emailWeeklyUpdateEnabled !== undefined) {
      changes.emailWeeklyUpdateEnabled = settings.emailWeeklyUpdateEnabled;
    }
    if (settings.emailUrgentCallsEnabled !== undefined) {
      changes.emailUrgentCallsEnabled = settings.emailUrgentCallsEnabled;
    }
    if (settings.emailPlatformEnabled !== undefined) {
      changes.emailPlatformEnabled = settings.emailPlatformEnabled;
    }

    const updatedFields = Object.keys(changes).sort();
    if (updatedFields.length === 0) {
      throw new BadRequestGraphQLError('No account settings provided');
    }

    const [user] = await this.db
      .update(schema.users)
      .set(changes)
      .where(eq(schema.users.id, userId))
      .returning();

    if (!user) {
      throw new NotFoundGraphQLError('User not found');
    }

    this.postHogService.capture({
      event: POSTHOG_EVENT.USER_UPDATE,
      userId,
      properties: {
        surface: POSTHOG_SURFACE.VOLUNTEERING,
        updated_field: updatedFields.join(','),
      },
    });

    return user;
  }

  async updateImage(
    userId: string,
    imageUrl: string | null,
  ): Promise<UserEntity> {
    const [user] = await this.db
      .update(schema.users)
      .set({ image: imageUrl })
      .where(eq(schema.users.id, userId))
      .returning();

    if (!user) {
      throw new NotFoundGraphQLError('User not found');
    }

    this.postHogService.capture({
      event: POSTHOG_EVENT.USER_UPDATE,
      userId,
      properties: {
        surface: POSTHOG_SURFACE.VOLUNTEERING,
        updated_field: 'image',
      },
    });

    return user;
  }

  async resolveLocale(
    userId: string,
    headers: Record<string, unknown>,
  ): Promise<Locale> {
    const user = await this.db.query.users.findFirst({
      where: { id: userId },
      columns: { locale: true },
    });

    if (user?.locale) {
      return user.locale as Locale;
    }

    const detected = resolveRequestLocale(headers);

    await this.db
      .update(schema.users)
      .set({ locale: detected })
      .where(eq(schema.users.id, userId));

    return detected;
  }

  async findOrganizationUserProfile(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationUserProfileEntity> {
    const organizationUserProfile =
      await this.db.query.organizationUserProfiles.findFirst({
        where: { userId, organizationId },
      });
    if (organizationUserProfile) {
      return organizationUserProfile;
    }

    const [newOrganizationUserProfile] = await this.db
      .insert(schema.organizationUserProfiles)
      .values({ userId, organizationId })
      .returning();

    return newOrganizationUserProfile;
  }
}
