import { sleep } from 'k6';
import exec from 'k6/execution';
import { graphql } from '../lib/client.ts';
import {
  coordinatorForVu,
  pickRandom,
  type SetupData,
  unitState,
  volunteersOfUnit,
} from '../lib/data.ts';
import { daysFrom, startOfToday, think } from '../lib/time.ts';

/**
 * A check-in desk: the coordinator scans a volunteer's check-in code, checks
 * them into today's desk shift and checks them out again.
 */
export function kioskJourney(data: SetupData) {
  const coordinator = coordinatorForVu(exec.vu.idInTest);
  const unit = unitState(data, coordinator.unitId);
  const unitVolunteers = volunteersOfUnit(coordinator.unitId);
  if (!unit?.checkInInstanceId || unitVolunteers.length === 0) {
    return;
  }
  const session = { cookie: coordinator.cookie, unitId: coordinator.unitId };
  const volunteer = pickRandom(unitVolunteers);

  graphql(session, 'GetCheckInShiftInstances', {
    startsAfter: startOfToday().toISOString(),
    endsBefore: daysFrom(startOfToday(), 1).toISOString(),
  });
  graphql(session, 'GetCheckInContext', { checkInId: volunteer.checkInId });
  graphql(session, 'GetCheckInReadiness', {
    checkInId: volunteer.checkInId,
    shiftInstanceId: unit.checkInInstanceId,
  });
  const checkIn = graphql(session, 'CheckInVolunteer', {
    volunteerId: volunteer.id,
    shiftInstanceId: unit.checkInInstanceId,
  });
  think();

  const timeEntryId = (checkIn?.checkInVolunteer as { id?: string } | undefined)
    ?.id;
  if (timeEntryId) {
    sleep(1);
    graphql(session, 'CheckOutVolunteer', { timeEntryId });
  }
  think();
}
