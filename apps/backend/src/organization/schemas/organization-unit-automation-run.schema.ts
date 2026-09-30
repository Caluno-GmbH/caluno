import { date, index, snakeCase, unique, uuid } from 'drizzle-orm/pg-core';
import { idColumn, timestampColumns } from '../../database/database-columns';
import type { OrganizationUnitAutomationKind } from '../enums';
import { organizationUnits } from './organization-unit.schema';
import { organizationUnitAutomationKindEnum } from './organization-unit-automation.schema';

export const organizationUnitAutomationRuns = snakeCase.table(
  'organization_unit_automation_runs',
  {
    ...idColumn,
    organizationUnitId: uuid('organization_unit_id')
      .references(() => organizationUnits.id, { onDelete: 'cascade' })
      .notNull(),
    kind: organizationUnitAutomationKindEnum('kind')
      .$type<OrganizationUnitAutomationKind>()
      .notNull(),
    runOn: date('run_on').notNull(),
    ...timestampColumns,
  },
  (table) => [
    unique('uq_organization_unit_automation_runs_unit_kind_day').on(
      table.organizationUnitId,
      table.kind,
      table.runOn,
    ),
    index('idx_organization_unit_automation_runs_run_on').on(table.runOn),
  ],
);

export type OrganizationUnitAutomationRunEntity =
  typeof organizationUnitAutomationRuns.$inferSelect;
