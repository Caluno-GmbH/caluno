import { SharedArray } from 'k6/data';

export interface CoordinatorFixture {
  id: string;
  unitId: string;
  cookie: string;
}

export interface VolunteerFixture extends CoordinatorFixture {
  checkInId: string;
}

export interface InstanceRef {
  id: string;
  shiftId: string;
}

/** A unit's shift instances, discovered through the API in `setup()`. */
export interface UnitState {
  id: string;
  upcomingInstances: InstanceRef[];
  checkInInstanceId: string | null;
  callOutInstanceId: string | null;
}

export interface SetupData {
  units: UnitState[];
}

interface LoadTestData {
  units: Array<{ id: string }>;
  coordinators: CoordinatorFixture[];
  volunteers: VolunteerFixture[];
}

const DATA_FILE =
  __ENV.DATA_FILE || import.meta.resolve('../../.data/load-test.json');
const OPERATIONS_FILE = import.meta.resolve('../../.data/operations.json');

const readData = (): LoadTestData => JSON.parse(open(DATA_FILE));

export const coordinators = new SharedArray(
  'coordinators',
  () => readData().coordinators,
);
export const volunteers = new SharedArray(
  'volunteers',
  () => readData().volunteers,
);

const operations: Record<string, string> = JSON.parse(open(OPERATIONS_FILE));

export const operation = (name: string): string => {
  const document = operations[name];
  if (!document) {
    throw new Error(
      `Unknown GraphQL operation "${name}" — run \`bun run operations\``,
    );
  }
  return document;
};

const at = <T>(items: ArrayLike<T>, index: number): T => {
  if (items.length === 0) {
    throw new Error('Load-test data is empty — run `bun run data` first');
  }
  return items[index % items.length] as T;
};

export const pickRandom = <T>(items: ArrayLike<T>): T =>
  at(items, Math.floor(Math.random() * items.length));

/** Each VU sticks to one account, like a real user. */
export const volunteerForVu = (vu: number): VolunteerFixture =>
  at(volunteers, vu - 1);

export const coordinatorForVu = (vu: number): CoordinatorFixture =>
  at(coordinators, vu - 1);

export const unitState = (
  data: SetupData,
  unitId: string,
): UnitState | undefined => data.units.find((unit) => unit.id === unitId);

const volunteersByUnit = new Map<string, VolunteerFixture[]>();

/**
 * Volunteers who are members of a unit. Memoized per VU: every SharedArray
 * read deserializes the element, so scanning it per iteration is expensive.
 */
export const volunteersOfUnit = (unitId: string): VolunteerFixture[] => {
  const cached = volunteersByUnit.get(unitId);
  if (cached) {
    return cached;
  }
  const result: VolunteerFixture[] = [];
  for (let index = 0; index < volunteers.length; index++) {
    const volunteer = volunteers[index] as VolunteerFixture;
    if (volunteer.unitId === unitId) {
      result.push(volunteer);
    }
  }
  volunteersByUnit.set(unitId, result);
  return result;
};
