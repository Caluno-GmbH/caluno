import { ContractStatus } from '../enums';

/** Which contract statuses count as cover for a time entry. */
export enum ContractCover {
  /**
   * Signed by everyone. The only cover that makes hours compliant or puts a
   * contract in the document bundle.
   */
  ACTIVE = 'ACTIVE',
  /**
   * Any contract that was not declined. A draft or awaiting-signature contract
   * is already its own task, so it suppresses a new draft and a contract
   * reminder — but never makes hours compliant.
   */
  OPEN = 'OPEN',
}

/** One instant that needs a contract: normally a time entry's `startedAt`. */
export interface CoverageTarget {
  /**
   * Identifies the target in the result; the time entry id when there is one.
   * Unique per call: see `matchCoveringContracts`.
   */
  key: string;
  volunteerId: string;
  reimbursementTypeId: string;
  organizationUnitId: string;
  at: Date;
}

export interface CoverageContract {
  id: string;
  volunteerId: string;
  reimbursementTypeId: string;
  organizationUnitId: string | null;
  contractStatus: ContractStatus;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

export interface CoverableTimeEntry {
  id: string;
  volunteerId: string;
  reimbursementTypeId: string | null;
  organizationUnitId: string;
  startedAt: Date;
}

export function contractCountsAsCover(
  status: ContractStatus,
  cover: ContractCover,
): boolean {
  return cover === ContractCover.ACTIVE
    ? status === ContractStatus.ACTIVE
    : status !== ContractStatus.DECLINED;
}

/** Periods are Berlin day bounds with an exclusive end: `periodStart <= at < periodEnd`. */
export function contractCoversInstant(
  contract: Pick<CoverageContract, 'periodStart' | 'periodEnd'>,
  at: Date,
): boolean {
  const instant = at.getTime();
  return (
    contract.periodStart.getTime() <= instant &&
    instant < contract.periodEnd.getTime()
  );
}

const SCOPE_SEPARATOR = '\u0000';

function scopeKey(
  volunteerId: string,
  reimbursementTypeId: string,
  organizationUnitId: string,
): string {
  return [volunteerId, reimbursementTypeId, organizationUnitId].join(
    SCOPE_SEPARATOR,
  );
}

function isSameTarget(a: CoverageTarget, b: CoverageTarget): boolean {
  return (
    a.volunteerId === b.volunteerId &&
    a.reimbursementTypeId === b.reimbursementTypeId &&
    a.organizationUnitId === b.organizationUnitId &&
    a.at.getTime() === b.at.getTime()
  );
}

/** Newest `createdAt` first; equal timestamps fall back to id so the order is stable. */
function compareNewestFirst(a: CoverageContract, b: CoverageContract): number {
  const byCreatedAt = b.createdAt.getTime() - a.createdAt.getTime();
  if (byCreatedAt !== 0) return byCreatedAt;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/**
 * The contracts covering each target, newest first by `createdAt`. Every
 * target key is present in the result; an uncovered one maps to an empty
 * list. A contract only covers hours of its own volunteer, reimbursement type
 * and organization unit — reimbursement types are global, so without the unit
 * a contract from another unit or organization would count. A contract
 * without a unit covers nothing.
 *
 * Target keys must be unique. Repeating a key for an identical target is
 * allowed; reusing it for a different target throws, because the result map
 * could hold only one of the two answers.
 */
export function matchCoveringContracts<C extends CoverageContract>(
  contracts: readonly C[],
  targets: readonly CoverageTarget[],
  cover: ContractCover,
): Map<string, C[]> {
  const byScope = new Map<string, C[]>();
  for (const contract of contracts) {
    if (contract.organizationUnitId === null) continue;
    if (!contractCountsAsCover(contract.contractStatus, cover)) continue;
    const key = scopeKey(
      contract.volunteerId,
      contract.reimbursementTypeId,
      contract.organizationUnitId,
    );
    const group = byScope.get(key);
    if (group) group.push(contract);
    else byScope.set(key, [contract]);
  }
  for (const group of byScope.values()) group.sort(compareNewestFirst);

  const covering = new Map<string, C[]>();
  const seen = new Map<string, CoverageTarget>();
  for (const target of targets) {
    const previous = seen.get(target.key);
    if (previous) {
      if (!isSameTarget(previous, target)) {
        throw new Error(
          `Coverage target key "${target.key}" is used for two different targets`,
        );
      }
      continue;
    }
    seen.set(target.key, target);
    const candidates =
      byScope.get(
        scopeKey(
          target.volunteerId,
          target.reimbursementTypeId,
          target.organizationUnitId,
        ),
      ) ?? [];
    covering.set(
      target.key,
      candidates.filter((contract) =>
        contractCoversInstant(contract, target.at),
      ),
    );
  }
  return covering;
}

/** Coverage is checked at the moment an entry starts. Unpaid entries need no contract. */
export function coverageTargetsForTimeEntries(
  entries: readonly CoverableTimeEntry[],
): CoverageTarget[] {
  const targets: CoverageTarget[] = [];
  for (const entry of entries) {
    if (!entry.reimbursementTypeId) continue;
    targets.push({
      key: entry.id,
      volunteerId: entry.volunteerId,
      reimbursementTypeId: entry.reimbursementTypeId,
      organizationUnitId: entry.organizationUnitId,
      at: entry.startedAt,
    });
  }
  return targets;
}
