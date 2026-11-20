import type { Options, Scenario } from 'k6/options';
import { config, type Profile } from './lib/config.ts';

type Journey = 'volunteer' | 'coordinator' | 'kiosk' | 'visitor';

/** Share of concurrent users per journey on a normal day. */
const MIX: Record<Journey, number> = {
  volunteer: 0.65,
  coordinator: 0.2,
  kiosk: 0.05,
  visitor: 0.1,
};

const EXEC: Record<Journey | 'callOut', string> = {
  volunteer: 'volunteerJourney',
  coordinator: 'coordinatorJourney',
  kiosk: 'kioskJourney',
  visitor: 'visitorJourney',
  callOut: 'callOutJourney',
};

type Stage = { duration: string; target: number };

const share = (users: number, journey: Journey) =>
  Math.max(1, Math.round(users * MIX[journey]));

const ramping = (journey: Journey, stages: Stage[]): Scenario => ({
  executor: 'ramping-vus',
  exec: EXEC[journey],
  startVUs: 0,
  stages: stages.map((stage) => ({
    duration: stage.duration,
    target: stage.target === 0 ? 0 : share(stage.target, journey),
  })),
  gracefulRampDown: '30s',
});

const mixed = (stages: Stage[]): Record<string, Scenario> =>
  Object.fromEntries(
    (Object.keys(MIX) as Journey[]).map((journey) => [
      journey,
      ramping(journey, stages),
    ]),
  );

/** Doubling steps: 2 min ramp + 3 min hold each, up to STRESS_MAX_USERS. */
const stressStages = (): Stage[] => {
  const stages: Stage[] = [];
  for (let users = 50; users <= config.stressMaxUsers; users *= 2) {
    stages.push(
      { duration: '2m', target: users },
      { duration: '3m', target: users },
    );
  }
  stages.push({ duration: '1m', target: 0 });
  return stages;
};

const scenarios = (profile: Profile): Record<string, Scenario> => {
  const target = config.targetUsers;
  switch (profile) {
    case 'smoke':
      return Object.fromEntries(
        [...(Object.keys(MIX) as Journey[]), 'callOut' as const].map(
          (journey) => [
            journey,
            {
              executor: 'per-vu-iterations',
              exec: EXEC[journey],
              vus: 1,
              iterations: 1,
            } satisfies Scenario,
          ],
        ),
      );
    case 'load':
      return mixed([
        { duration: '5m', target },
        { duration: config.loadHold, target },
        { duration: '2m', target: 0 },
      ]);
    case 'stress':
      return mixed(stressStages());
    case 'spike': {
      const background = Math.round(target / 4);
      return {
        ...mixed([
          { duration: '1m', target: background },
          { duration: '5m', target: background },
          { duration: '30s', target: 0 },
        ]),
        callOut: {
          executor: 'ramping-vus',
          exec: EXEC.callOut,
          startTime: '1m30s',
          startVUs: 0,
          stages: [
            { duration: '30s', target: config.spikeUsers },
            { duration: '2m', target: config.spikeUsers },
            { duration: '30s', target: 0 },
          ],
          gracefulRampDown: '10s',
        },
      };
    }
    case 'soak':
      return mixed([
        { duration: '5m', target },
        { duration: config.soakDuration, target },
        { duration: '2m', target: 0 },
      ]);
  }
};

const abortOnFail = config.profile === 'stress';

/**
 * Pass/fail bar. In the stress profile a sustained breach aborts the run, so
 * the last completed step is the capacity answer.
 */
const thresholds = (): Options['thresholds'] => ({
  http_req_failed: [
    { threshold: 'rate<0.01', abortOnFail, delayAbortEval: '1m' },
  ],
  'http_req_duration{kind:read}': [
    { threshold: 'p(95)<500', abortOnFail, delayAbortEval: '1m' },
  ],
  'http_req_duration{kind:write}': ['p(95)<1000'],
  'http_req_duration{kind:auth}': ['p(95)<300'],
  'http_req_duration{kind:page}': ['p(95)<1500'],
  graphql_errors: ['rate<0.01'],
  rate_limited: ['count<1'],
  checks: ['rate>0.99'],
});

export const options = (): Options => ({
  scenarios: scenarios(config.profile),
  thresholds: thresholds(),
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  setupTimeout: '30s',
});
