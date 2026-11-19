import { sleep } from 'k6';
import exec from 'k6/execution';
import { graphql, graphqlBatch } from '../lib/client.ts';
import {
  type SetupData,
  type VolunteerFixture,
  volunteersOfUnit,
} from '../lib/data.ts';

/**
 * The understaffed-shift emails went out: volunteers open their unit's
 * call-out shift within seconds of each other and race for its 10 spots.
 * VUs are spread over every org's call-out shift; members of the same unit
 * contend on the same instance.
 */
export function callOutJourney(data: SetupData) {
  const hot = data.units.filter((unit) => unit.callOutInstanceId);
  if (hot.length === 0) {
    return;
  }
  const vu = exec.vu.idInTest - 1;
  const unit = hot[vu % hot.length] as (typeof hot)[number];
  const candidates = volunteersOfUnit(unit.id);
  if (candidates.length === 0) {
    return;
  }
  const volunteer = candidates[
    Math.floor(vu / hot.length) % candidates.length
  ] as VolunteerFixture;
  const session = { cookie: volunteer.cookie };
  const instanceId = unit.callOutInstanceId as string;

  graphqlBatch(session, [
    { name: 'GetPublicShiftInstance', variables: { id: instanceId } },
    { name: 'GetMe' },
  ]);
  sleep(1 + Math.random() * 3);
  graphql(session, 'JoinShiftInstance', { instanceId });
  graphql(session, 'GetMyShiftInstances', { limit: 15 });
  sleep(2 + Math.random() * 5);
}
