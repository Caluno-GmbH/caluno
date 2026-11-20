import exec from 'k6/execution';
import { graphql, graphqlBatch, view } from '../lib/client.ts';
import {
  coordinatorForVu,
  pickRandom,
  type SetupData,
  unitState,
} from '../lib/data.ts';
import { daysFrom, startOfToday, startOfWeek, think } from '../lib/time.ts';

/**
 * A coordinator working in the backoffice: overview, weekly shift plan, a
 * shift's roster, volunteers, timesheets and events. Read-only on purpose —
 * the backoffice writes (roster edits, approvals) would reshape the dataset
 * between runs.
 */
export function coordinatorJourney(data: SetupData) {
  const coordinator = coordinatorForVu(exec.vu.idInTest);
  const unit = unitState(data, coordinator.unitId);
  const session = { cookie: coordinator.cookie, unitId: coordinator.unitId };
  const adminPath = `/admin/${coordinator.unitId}`;

  view(session, adminPath, () =>
    graphqlBatch(session, [
      { name: 'GetMyAdminstableOrganizationUnits' },
      { name: 'GetMyPermissions' },
      {
        name: 'GetMembershipRequestCount',
        variables: { status: 'PENDING' },
      },
    ]),
  );
  think();

  view(session, `${adminPath}/shifts`, () =>
    graphqlBatch(session, [
      {
        name: 'GetWeeklyShifts',
        variables: {
          startsAfter: startOfWeek().toISOString(),
          endsBefore: daysFrom(startOfWeek(), 7).toISOString(),
        },
      },
      { name: 'GetShiftCount' },
    ]),
  );
  think();

  const instances = unit?.upcomingInstances ?? [];
  if (instances.length > 0) {
    const instanceId = pickRandom(instances).id;
    graphqlBatch(session, [
      { name: 'GetShiftInstance', variables: { id: instanceId } },
      { name: 'GetShiftVolunteers', variables: { instanceId } },
    ]);
    think();
  }

  view(session, `${adminPath}/volunteers`, () =>
    graphql(session, 'GetOrganizationUnitMemberships'),
  );
  think();

  view(session, `${adminPath}/timesheets`, () =>
    graphql(session, 'GetTimeEntries', {
      limit: 20,
      offset: 0,
      dateFrom: daysFrom(startOfToday(), -30).toISOString(),
    }),
  );
  think();

  view(session, `${adminPath}/events`, () =>
    graphql(session, 'GetEvents', { limit: 20, offset: 0 }),
  );
  think();
}
