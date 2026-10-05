import {
  boolean,
  index,
  snakeCase,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { timestampColumns } from '../../database/database-columns';
import { generateCheckInId } from '../checkInId';

export const users = snakeCase.table('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  locale: text('locale'),
  emailWeeklyUpdateEnabled: boolean('email_weekly_update_enabled')
    .default(true)
    .notNull(),
  emailUrgentCallsEnabled: boolean('email_urgent_calls_enabled')
    .default(true)
    .notNull(),
  emailPlatformEnabled: boolean('email_platform_enabled')
    .default(true)
    .notNull(),
  privacyPolicyVersion: text('privacy_policy_version'),
  privacyPolicyAcceptedAt: timestamp('privacy_policy_accepted_at'),
  checkInId: text('check_in_id')
    .notNull()
    .unique()
    .$defaultFn(generateCheckInId),
  // Profile fields (formerly user_profiles.data) — VOLI-1524
  // firstname/lastname are source of truth; `name` is always dual-written as
  // `firstname + " " + lastname` for Better Auth + display.
  firstname: text('firstname').notNull(),
  lastname: text('lastname').notNull(),
  preferredName: text('preferred_name'),
  gender: text('gender'),
  phone: text('phone'),
  street: text('street'),
  zip: text('zip'),
  city: text('city'),
  birthdate: text('birthdate'),
  iban: text('iban'),
  accountHolder: text('account_holder'),
  bic: text('bic'),
  ...timestampColumns,
});

export const sessions = snakeCase.table(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestampColumns,
  },
  (table) => [index('sessions_userId_idx').on(table.userId)],
);

export const accounts = snakeCase.table(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    ...timestampColumns,
  },
  (table) => [index('accounts_userId_idx').on(table.userId)],
);

export const verifications = snakeCase.table(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    ...timestampColumns,
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
);

export type UserEntity = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
