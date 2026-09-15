import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import type { EligibleTimesheetVolunteer } from '../src/accounting/accounting.types';
import { ReimbursementTypeMapper } from '../src/accounting/mappers';
import { InvoiceQueryResolver } from '../src/accounting/resolvers/invoice-query.resolver';
import { AccountingOrgAccessService } from '../src/accounting/services/accounting-org-access.service';
import type { InvoiceService } from '../src/accounting/services/invoice.service';
import { ReimbursementRateService } from '../src/accounting/services/reimbursement-rate.service';
import type { AuthService } from '../src/auth/auth.service';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import type { AuthenticatedGraphQLContext } from '../src/graphql/graphql.context';
import { MembershipService } from '../src/membership/membership.service';
import type { NotificationService } from '../src/notification';
import { OrganizationUnitService } from '../src/organization/organization-unit.service';
import { OrganizationUnitDataModule } from '../src/organization/organization-unit-data.module';
import { OrganizationUnitDataService } from '../src/organization/organization-unit-data.service';
import type { RequiredFormService } from '../src/requirement-profile/services/required-form.service';
import type { RequirementProfileService } from '../src/requirement-profile/services/requirement-profile.service';
import { PostHogService } from '../src/shared/observability/posthog.service';
import type { FileService } from '../src/storage/services/file.service';
import { UserMapper } from '../src/user/mappers/user.mapper';
import { UserService } from '../src/user/user.service';
import { createReimbursementType } from './factories/accounting.factory';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { createUser } from './factories/user.factory';
import {
  ensureTestDatabase,
  registerTestResourceCleanup,
} from './helpers/ensure-test-database';

/**
 * The `volunteersNeedingTimesheets` resolver is the only place that turns the
 * service's grouped rows into the board projection: it passes the month bounds
 * through and estimates the amount from the unit's effective rate. Cover that
 * projection here (the grouping itself is covered in invoice.service.spec.ts).
 */
describe('volunteersNeedingTimesheets projection', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let resolver: InvoiceQueryResolver;
  let rateService: ReimbursementRateService;
  let timesheetRows: EligibleTimesheetVolunteer[];

  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        OrganizationUnitDataModule,
      ],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);

    const organizationUnitDataService = moduleRef.get(
      OrganizationUnitDataService,
    );
    const organizationUnitService = new OrganizationUnitService(
      db,
      {} as FileService,
      organizationUnitDataService,
      { capture: () => {} } as unknown as PostHogService,
    );
    const membershipService = new MembershipService(
      db,
      {} as RequirementProfileService,
      {} as AuthService,
      {} as NotificationService,
      {} as RequiredFormService,
      { shareSubmissionsWithOrgUnit: async () => {} } as never,
      { capture: () => {} } as unknown as PostHogService,
      {} as never,
    );
    rateService = new ReimbursementRateService(
      db,
      organizationUnitDataService,
      membershipService,
      { capture: () => {} } as unknown as PostHogService,
    );
    const userService = new UserService(db, {
      capture: () => {},
    } as unknown as PostHogService);
    const accountingOrgAccessService = new AccountingOrgAccessService(
      db,
      organizationUnitService,
    );

    const invoiceService = {
      findVolunteersNeedingTimesheets: async () => timesheetRows,
    } as unknown as InvoiceService;
    resolver = new InvoiceQueryResolver(
      invoiceService,
      {} as never,
      {} as never,
      {} as AuthService,
      organizationUnitService,
      accountingOrgAccessService,
      new UserMapper(),
      userService,
      new ReimbursementTypeMapper(),
      rateService,
    );

    registerTestResourceCleanup(async () => {
      await moduleRef.close();
    });
  });

  const setup = async () => {
    const reimbursementType = await createReimbursementType(db, {
      platformDefaultRateCents: 1_500,
    });
    const { organization, type } = await createOrganizationWithType(
      db,
      `Needs Timesheet Org ${crypto.randomUUID()}`,
    );
    await db
      .update(schema.organizations)
      .set({ accountingEnabled: true })
      .where(eq(schema.organizations.id, organization.id));
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'root',
    });
    const volunteer = await createUser(db);
    return { organization, unit, reimbursementType, volunteer };
  };

  const contextFor = (organizationUnitId: string) =>
    ({ organizationUnitId }) as AuthenticatedGraphQLContext;

  it('passes the month bounds through and estimates at the unit rate', async () => {
    const { organization, unit, reimbursementType, volunteer } = await setup();
    await rateService.setReimbursementRate(
      organization.id,
      reimbursementType.id,
      2_000,
      volunteer.id,
      unit.id,
    );
    timesheetRows = [
      {
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        periodStart: new Date('2026-06-30T22:00:00.000Z'),
        periodEnd: new Date('2026-07-31T22:00:00.000Z'),
        eligibleHours: 6.5,
      },
    ];

    const [row] = await resolver.volunteersNeedingTimesheets(
      null,
      null,
      contextFor(unit.id),
    );

    expect(row?.periodStart).toEqual(new Date('2026-06-30T22:00:00.000Z'));
    expect(row?.periodEnd).toEqual(new Date('2026-07-31T22:00:00.000Z'));
    expect(row?.eligibleHours).toBe(6.5);
    expect(row?.estimatedAmountCents).toBe(13_000);
  });

  it('falls back to the platform default when the unit has no rate', async () => {
    const { unit, reimbursementType, volunteer } = await setup();
    timesheetRows = [
      {
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        periodStart: new Date('2026-06-30T22:00:00.000Z'),
        periodEnd: new Date('2026-07-31T22:00:00.000Z'),
        eligibleHours: 2,
      },
    ];

    const [row] = await resolver.volunteersNeedingTimesheets(
      null,
      null,
      contextFor(unit.id),
    );

    expect(row?.estimatedAmountCents).toBe(3_000);
  });
});
