import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgEnum,
  smallint,
  snakeCase,
  time,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { enumValues } from '../../database/typeutil';
import { Weekday } from '../../shared/enums/weekday.enum';
import { OrganizationUnitAutomationKind } from '../enums';
import { organizationUnits } from './organization-unit.schema';

export const weekdayEnum = pgEnum('weekday', enumValues(Weekday));

export const organizationUnitAutomationKindEnum = pgEnum(
  'organization_unit_automation_kind',
  enumValues(OrganizationUnitAutomationKind),
);

export const organizationUnitAutomations = snakeCase.table(
  'organization_unit_automations',
  {
    ...idColumn,
    organizationUnitId: uuid('organization_unit_id')
      .references(() => organizationUnits.id, { onDelete: 'cascade' })
      .notNull(),
    kind: organizationUnitAutomationKindEnum('kind')
      .$type<OrganizationUnitAutomationKind>()
      .notNull(),
    enabled: boolean('enabled').notNull().default(false),
    activeDays: weekdayEnum('active_days')
      .$type<Weekday>()
      .array()
      .notNull()
      .default(sql`ARRAY[]::weekday[]`),
    leadTimeHours: smallint('lead_time_hours'),
    sendAtTime: time('send_at_time'),
    ...timestampColumns,
  },
  (table) => [
    unique('uq_organization_unit_automations_unit_id_kind').on(
      table.organizationUnitId,
      table.kind,
    ),
    index('idx_organization_unit_automations_unit_id').on(
      table.organizationUnitId,
    ),
    check(
      'chk_organization_unit_automations_lead_time_hours',
      sql`${table.leadTimeHours} IS NULL OR ${table.leadTimeHours} IN (12, 24, 48, 72)`,
    ),
  ],
);

export type OrganizationUnitAutomationEntity =
  typeof organizationUnitAutomations.$inferSelect;
