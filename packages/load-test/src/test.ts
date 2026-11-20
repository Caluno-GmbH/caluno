import http from 'k6/http';
import { graphql } from './lib/client.ts';
import { API_URL, config, SESSION_COOKIE_NAME, WEB_URL } from './lib/config.ts';
import {
  type CoordinatorFixture,
  coordinators,
  type InstanceRef,
  type SetupData,
  type UnitState,
  volunteers,
} from './lib/data.ts';
import { daysFrom, startOfToday } from './lib/time.ts';
import { options as buildOptions } from './profiles.ts';

export { callOutJourney } from './scenarios/call-out.ts';
export { coordinatorJourney } from './scenarios/coordinator.ts';
export { kioskJourney } from './scenarios/kiosk.ts';
export { visitorJourney } from './scenarios/visitor.ts';
export { volunteerJourney } from './scenarios/volunteer.ts';

export const options = buildOptions();

const CHECK_IN_DESK_TITLE = 'Check-in Desk';
const CALL_OUT_TITLE = 'Urgent Call-out';
const UPCOMING_SAMPLE = 20;

type DiscoveredInstance = {
  id: string;
  actualStartsAt: string;
  overrideTitle: string | null;
  master: { id: string; title: string };
};

/** Finds a unit's upcoming, check-in desk and call-out shift instances. */
const discoverUnit = (coordinator: CoordinatorFixture): UnitState => {
  const today = startOfToday();
  const data = graphql(
    { cookie: coordinator.cookie, unitId: coordinator.unitId },
    'GetCheckInShiftInstances',
    {
      startsAfter: today.toISOString(),
      endsBefore: daysFrom(today, 14).toISOString(),
    },
  );
  const instances = (data?.checkInShiftInstances ?? []) as DiscoveredInstance[];
  const titled = (title: string) =>
    instances.find((instance) => instance.master.title === title)?.id ?? null;
  const now = Date.now();
  const upcomingInstances: InstanceRef[] = instances
    .filter(
      (instance) =>
        new Date(instance.actualStartsAt).getTime() > now &&
        instance.master.title !== CALL_OUT_TITLE,
    )
    .slice(0, UPCOMING_SAMPLE)
    .map((instance) => ({ id: instance.id, shiftId: instance.master.id }));

  return {
    id: coordinator.unitId,
    upcomingInstances,
    checkInInstanceId: titled(CHECK_IN_DESK_TITLE),
    callOutInstanceId: titled(CALL_OUT_TITLE),
  };
};

/**
 * Fails fast on a wrong target, a missing seed or sessions signed with another
 * secret, then discovers each unit's shift instances for the journeys.
 */
export function setup(): SetupData {
  const health = http.get(`${API_URL}/health/ready`);
  if (health.status !== 200) {
    throw new Error(`${API_URL}/health/ready returned ${health.status}`);
  }

  const volunteer = volunteers[0];
  if (!volunteer || coordinators.length === 0) {
    throw new Error('No load-test data — run `bun run data` first');
  }
  const session = http.get(`${API_URL}/api/auth/get-session`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${volunteer.cookie}` },
  });
  if (session.status !== 200 || !session.json()) {
    throw new Error(
      `Seeded session rejected (HTTP ${session.status}). Check that the target ran the load-test seed and that BETTER_AUTH_SECRET and SESSION_COOKIE_NAME (${SESSION_COOKIE_NAME}) match it.`,
    );
  }

  const units: UnitState[] = [];
  for (let index = 0; index < coordinators.length; index++) {
    units.push(discoverUnit(coordinators[index] as CoordinatorFixture));
  }
  const callOuts = units.filter((unit) => unit.callOutInstanceId).length;
  if (units.every((unit) => unit.upcomingInstances.length === 0)) {
    throw new Error('No upcoming shift instances found — is the seed current?');
  }

  console.log(
    `Profile ${config.profile} against ${API_URL}${WEB_URL ? ` + ${WEB_URL}` : ''}: ${units.length} units, ${coordinators.length} coordinators, ${volunteers.length} volunteers, ${callOuts} call-out shifts`,
  );
  return { units };
}
