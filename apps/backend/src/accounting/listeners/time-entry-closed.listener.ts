import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { isExpectedGraphqlCode } from '@repo/observability';
import { GraphQLError } from 'graphql';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import { OrganizationUnitDataService } from '../../organization/organization-unit-data.service';
import { AccountingEvent } from '../../shared/accounting-events';
import { ObservabilityService } from '../../shared/observability/observability.service';
import { ContractService } from '../services/contract.service';

/**
 * When paid hours are recorded, makes sure the volunteer's yearly contract is
 * queued. Timesheets are deliberately not drafted here: a volunteer's entries
 * add up per month on the board and are only claimed once the coordinator
 * issues the timesheet, so one document can hold all of them.
 */
@Injectable()
export class TimeEntryClosedListener {
  private readonly logger = new Logger(TimeEntryClosedListener.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly contractService: ContractService,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  @OnEvent(AccountingEvent.TIME_ENTRY_CLOSED)
  async handleTimeEntryClosed(payload: { timeEntryId: string }): Promise<void> {
    try {
      const entry = await this.db.query.timeEntries.findFirst({
        where: { id: payload.timeEntryId },
      });
      if (!entry?.endedAt || !entry.reimbursementTypeId) return;

      const organization =
        await this.organizationUnitDataService.findOrganizationByUnitId(
          entry.organizationUnitId,
        );
      if (!organization) return;

      await this.contractService.ensureDraftContract(
        organization.id,
        {
          organizationUnitId: entry.organizationUnitId,
          volunteerId: entry.volunteerId,
          reimbursementTypeId: entry.reimbursementTypeId,
          periodStart: new Date(entry.startedAt),
        },
        entry.volunteerId,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to auto-draft a contract for time entry ${payload.timeEntryId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      // Expected domain errors (missing template, etc.) are control flow and
      // stay out of Sentry; anything else is a real failure worth reporting.
      if (
        !(
          error instanceof GraphQLError &&
          isExpectedGraphqlCode(error.extensions?.code)
        )
      ) {
        this.observabilityService.captureException(error);
      }
    }
  }
}
