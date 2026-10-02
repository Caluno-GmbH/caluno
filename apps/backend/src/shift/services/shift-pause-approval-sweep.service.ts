import { Injectable, Logger } from '@nestjs/common';
import { OrganizationUnitAutomationKind } from '../../organization/enums';
import { OrganizationUnitAutomationService } from '../../organization/organization-unit-automation.service';
import { ShiftService } from '../shift.service';
import { appWeekday, hoursUntil } from '../utils/app-time';
import { isApprovalPaused } from '../utils/approval-pause-decision';

// Matches the widest lead time a coordinator can choose (AUTOMATION_LEAD_TIME_HOURS).
const WINDOW_HOURS = 72;

export interface PauseApprovalSweepSummary {
  candidates: number;
  swept: number;
  skipped_automation_off: number;
  failed: number;
}

@Injectable()
export class ShiftPauseApprovalSweepService {
  private readonly logger = new Logger(ShiftPauseApprovalSweepService.name);

  constructor(
    private readonly shiftService: ShiftService,
    private readonly automationService: OrganizationUnitAutomationService,
  ) {}

  async runTick(now: Date = new Date()): Promise<PauseApprovalSweepSummary> {
    const candidates = await this.shiftService.findPauseApprovalSweepCandidates(
      now,
      WINDOW_HOURS,
    );
    const summary: PauseApprovalSweepSummary = {
      candidates: candidates.length,
      swept: 0,
      skipped_automation_off: 0,
      failed: 0,
    };
    if (candidates.length === 0) return summary;

    const [filledCounts, automations] = await Promise.all([
      this.shiftService.getFilledCounts(
        candidates.map((instance) => instance.id),
      ),
      this.automationService.resolveMany(
        candidates.map((instance) => instance.master.organizationUnitId),
        OrganizationUnitAutomationKind.PAUSE_APPROVAL,
      ),
    ]);

    const sweepInstanceIds: string[] = [];

    for (const instance of candidates) {
      const automation = automations.get(instance.master.organizationUnitId);
      if (!automation?.enabled) {
        summary.skipped_automation_off += 1;
        continue;
      }

      const joinRequiresApproval =
        instance.overrideJoinRequiresApproval ??
        instance.master.joinRequiresApproval;
      const minVolunteers =
        instance.overrideMinVolunteers ?? instance.master.minVolunteers;

      const paused = isApprovalPaused({
        joinRequiresApproval,
        automationEnabled: automation.enabled,
        activeDays: automation.activeDays,
        leadTimeHours: automation.leadTimeHours,
        shiftWeekday: appWeekday(instance.actualStartsAt),
        hoursUntilStart: hoursUntil(instance.actualStartsAt, now),
        minVolunteers,
        filledCount: filledCounts.get(instance.id) ?? 0,
      });

      this.logger.debug(
        {
          event: 'pause_approval_tick.instance_evaluated',
          instance_id: instance.id,
          shift_id: instance.masterId,
          organization_unit_id: instance.master.organizationUnitId,
          paused,
        },
        'Pause-approval sweep candidate evaluated',
      );

      if (paused) sweepInstanceIds.push(instance.id);
    }

    if (sweepInstanceIds.length === 0) return summary;

    try {
      await this.shiftService.sweepPausedApprovalInvites(sweepInstanceIds);
      summary.swept = sweepInstanceIds.length;
    } catch (error) {
      summary.failed = sweepInstanceIds.length;
      this.logger.error(
        {
          event: 'pause_approval_tick.sweep_failed',
          instance_ids: sweepInstanceIds,
          err: error,
        },
        'Failed to sweep awaiting-approval invites',
      );
    }

    return summary;
  }
}
