/**
 * The load-test dataset's identities, computable without a database.
 *
 * Account and unit ids come from `fixtureId`, and session tokens and check-in
 * codes are derived from BETTER_AUTH_SECRET. The seed (inside the target's
 * network) and the k6 data file (CI, outside it) therefore agree on every
 * cookie without the database ever leaving the private network.
 *
 * Anyone holding the target's BETTER_AUTH_SECRET can sign in as these
 * synthetic accounts — they only belong to the `loadtest-*` orgs, and the seed
 * only runs with APP_ENV=load-test.
 */
import { createHash, createHmac } from 'node:crypto';
import {
  fixtureOrgUnitId,
  fixtureUserId,
  type PlannedFixtureAccount,
} from './fixture-helpers';

const positiveIntegerEnv = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }
  return value;
};

export const LOAD_TEST_ORG_COUNT = positiveIntegerEnv('LOAD_TEST_ORGS', 10);
export const LOAD_TEST_VOLUNTEERS_PER_UNIT = positiveIntegerEnv(
  'LOAD_TEST_VOLUNTEERS_PER_UNIT',
  50,
);

const EMAIL_DOMAIN = 'example.com';
const CHECK_IN_ALPHABET = '123456789abcdefghijklmnopqrstuvwxyz';
const CHECK_IN_LENGTH = 12;

export const LOAD_TEST_REGIONS = [
  { key: 'nord', name: 'Nord' },
  { key: 'sued', name: 'Süd' },
  { key: 'west', name: 'West' },
] as const;

export type LoadTestUnitPlan = {
  slug: string;
  key: (typeof LOAD_TEST_REGIONS)[number]['key'];
  coordinator: PlannedFixtureAccount;
  volunteers: PlannedFixtureAccount[];
};

export type LoadTestOrgPlan = {
  slug: string;
  name: string;
  owner: PlannedFixtureAccount;
  units: LoadTestUnitPlan[];
};

const pad = (value: number, width: number) =>
  String(value).padStart(width, '0');

const email = (localPart: string) => `loadtest+${localPart}@${EMAIL_DOMAIN}`;

export const planLoadTestOrganizations = (): LoadTestOrgPlan[] =>
  Array.from({ length: LOAD_TEST_ORG_COUNT }, (_, orgIndex) => {
    const orgKey = `o${pad(orgIndex + 1, 2)}`;
    const slug = `loadtest-${orgKey}`;
    return {
      slug,
      name: `Load Test Org ${pad(orgIndex + 1, 2)}`,
      owner: {
        email: email(`${orgKey}-owner`),
        firstname: 'Owner',
        lastname: orgKey.toUpperCase(),
      },
      units: LOAD_TEST_REGIONS.map((region) => ({
        slug: `${slug}-${region.key}`,
        key: region.key,
        coordinator: {
          email: email(`${orgKey}-${region.key}-coordinator`),
          firstname: 'Coordinator',
          lastname: `${orgKey.toUpperCase()} ${region.name}`,
        },
        volunteers: Array.from(
          { length: LOAD_TEST_VOLUNTEERS_PER_UNIT },
          (_, volunteerIndex) => ({
            email: email(
              `${orgKey}-${region.key}-v${pad(volunteerIndex + 1, 4)}`,
            ),
            firstname: 'Volunteer',
            lastname: `${orgKey.toUpperCase()} ${region.name} ${pad(volunteerIndex + 1, 4)}`,
          }),
        ),
      })),
    };
  });

export const loadTestSessionToken = (secret: string, userId: string) =>
  createHmac('sha256', secret)
    .update(`load-test-session:${userId}`)
    .digest('base64url');

/** Same format as better-call's `signCookieValue`. */
export const signSessionCookie = (token: string, secret: string) =>
  encodeURIComponent(
    `${token}.${createHmac('sha256', secret).update(token).digest('base64')}`,
  );

/** A check-in code that is stable per user, so k6 knows it without the database. */
export const loadTestCheckInId = (userId: string) => {
  const digest = createHash('sha256').update(`load-test-check-in:${userId}`);
  const bytes = digest.digest();
  return Array.from(
    bytes.subarray(0, CHECK_IN_LENGTH),
    (byte) => CHECK_IN_ALPHABET[byte % CHECK_IN_ALPHABET.length],
  ).join('');
};

export type LoadTestData = {
  units: Array<{ id: string }>;
  coordinators: Array<{ id: string; unitId: string; cookie: string }>;
  volunteers: Array<{
    id: string;
    unitId: string;
    checkInId: string;
    cookie: string;
  }>;
};

/** What k6 reads: the accounts it acts as and the units they belong to. */
export const buildLoadTestData = (secret: string): LoadTestData => {
  const data: LoadTestData = { units: [], coordinators: [], volunteers: [] };
  const cookieFor = (userId: string) =>
    signSessionCookie(loadTestSessionToken(secret, userId), secret);

  for (const org of planLoadTestOrganizations()) {
    for (const unit of org.units) {
      const unitId = fixtureOrgUnitId(unit.slug);
      const coordinatorId = fixtureUserId(unit.coordinator.email);
      data.units.push({ id: unitId });
      data.coordinators.push({
        id: coordinatorId,
        unitId,
        cookie: cookieFor(coordinatorId),
      });
      for (const volunteer of unit.volunteers) {
        const volunteerId = fixtureUserId(volunteer.email);
        data.volunteers.push({
          id: volunteerId,
          unitId,
          checkInId: loadTestCheckInId(volunteerId),
          cookie: cookieFor(volunteerId),
        });
      }
    }
  }
  return data;
};
