import exec from 'k6/execution';
import { graphql, graphqlBatch, view } from '../lib/client.ts';
import {
  pickRandom,
  type SetupData,
  unitState,
  volunteerForVu,
} from '../lib/data.ts';
import { daysFrom, startOfToday, think } from '../lib/time.ts';

/** Share of shift detail views that end in a join. */
const JOIN_RATE = 0.1;
/** Share of joins the volunteer cancels again, keeping fill levels steady. */
const CANCEL_RATE = 0.5;
const DISCOVER_HORIZON_DAYS = 90;

type AvailableInstances = {
  availableShiftInstances?: {
    items?: Array<{ id: string; master?: { id: string } }>;
  };
};

const shiftInstances = (data: Record<string, unknown> | null) =>
  ((data as AvailableInstances | null)?.availableShiftInstances?.items ?? [])
    .filter((item) => item.master?.id)
    .map((item) => ({ id: item.id, shiftId: item.master?.id as string }));

/**
 * A volunteer session: home → discover → shift detail (sometimes join) →
 * my shifts → occasionally profile. Page loads mirror each page's SSR calls.
 */
export function volunteerJourney(data: SetupData) {
  const volunteer = volunteerForVu(exec.vu.idInTest);
  const session = { cookie: volunteer.cookie };
  const discoverWindow = {
    startsAfter: startOfToday().toISOString(),
    endsBefore: daysFrom(startOfToday(), DISCOVER_HORIZON_DAYS).toISOString(),
  };

  view(session, '', () =>
    graphqlBatch(session, [
      { name: 'GetMyAdminstableOrganizationUnits' },
      {
        name: 'GetMyShiftInstances',
        variables: { limit: 10, includeIntended: true },
      },
      { name: 'GetAvailableShiftInstances', variables: discoverWindow },
      { name: 'GetAvailableEvents', variables: { limit: 10 } },
      {
        name: 'GetMyShiftInstances',
        variables: { limit: 10, statuses: ['ADMIN_INVITED'] },
      },
      {
        name: 'GetMyEvents',
        variables: { limit: 10, statuses: ['ADMIN_INVITED'] },
      },
      { name: 'GetMyEvents', variables: { limit: 10, statuses: ['JOINED'] } },
      { name: 'MyMemberships' },
      { name: 'GetMyMembershipRequests', variables: { limit: 10, offset: 0 } },
    ]),
  );
  graphql(session, 'GetMe');
  think();

  const discover = view(session, '/discover', () =>
    graphqlBatch(session, [
      { name: 'GetAvailableShiftInstances', variables: discoverWindow },
      { name: 'GetAvailableShiftInstanceDayCounts', variables: discoverWindow },
      { name: 'GetAvailableEvents', variables: discoverWindow },
    ]),
  );
  think();

  const discovered = shiftInstances(discover?.[0] ?? null);
  const candidates =
    discovered.length > 0
      ? discovered
      : (unitState(data, volunteer.unitId)?.upcomingInstances ?? []);
  if (candidates.length > 0) {
    const { id: instanceId, shiftId } = pickRandom(candidates);
    view(session, `/shifts/${shiftId}?instanceId=${instanceId}`, () =>
      graphqlBatch(session, [
        { name: 'GetShift', variables: { id: shiftId } },
        { name: 'GetPublicShiftInstance', variables: { id: instanceId } },
      ]),
    );
    think();

    if (Math.random() < JOIN_RATE) {
      graphql(session, 'JoinShiftInstance', { instanceId });
      if (Math.random() < CANCEL_RATE) {
        graphql(session, 'UpdateShiftInstanceInviteStatus', {
          instanceId,
          status: 'VOLUNTEER_CANCELLED',
        });
      }
      think();
    }
  }

  view(session, '/my-shifts', () =>
    graphql(session, 'GetMyShiftInstances', { limit: 15 }),
  );
  think();

  if (Math.random() < 0.3) {
    view(session, '/profile', () =>
      graphqlBatch(session, [
        { name: 'GetMyTime', variables: { limit: 20, offset: 0 } },
        { name: 'MyMemberships' },
      ]),
    );
    think();
  }
}
