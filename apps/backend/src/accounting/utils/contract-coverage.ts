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
  /** Identifies the target in the result; the time entry id when there is one. */
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

/**
 * The contracts covering each target, newest first by `createdAt`. Every
 * target key is present in the result; an uncovered one maps to an empty
 * list. A contract only covers hours of its own volunteer, reimbursement type
 * and organization unit — reimbursement types are global, so without the unit
 * a contract from another unit or organization would count.
 */
export function matchCoveringContracts<C extends CoverageContract>(
  contracts: readonly C[],
  targets: readonly CoverageTarget[],
  cover: ContractCover,
): Map<string, C[]> {
  const newestFirst = contracts
    .filter((contract) => contractCountsAsCover(contract.contractStatus, cover))
    .sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
    );

  const covering = new Map<string, C[]>();
  for (const target of targets) {
    covering.set(
      target.key,
      newestFirst.filter(
        (contract) =>
          contract.volunteerId === target.volunteerId &&
          contract.reimbursementTypeId === target.reimbursementTypeId &&
          contract.organizationUnitId === target.organizationUnitId &&
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
