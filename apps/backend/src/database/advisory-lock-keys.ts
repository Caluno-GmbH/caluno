/**
 * Stable keys for Postgres advisory locks that serialise background jobs
 * across multiple backend instances. Keys are namespaced per database, so a
 * deployment only needs to keep this list collision-free within itself.
 *
 * The numbers are arbitrary — the shared `874213001` base is not derived from
 * anything. They only have to stay identical on every replica of a given build
 * and unique within the database: old and new builds that disagree on a key do
 * not exclude each other during a rolling deploy and can double-send.
 * `termsPublish` deliberately keeps the value the terms publisher used before
 * this list existed, so a mixed-version rollout still shares one lock.
 */
export const ADVISORY_LOCK_KEYS = {
  termsPublish: 874_213_001,
  shiftUnderstaffedTick: 874_213_002,
  shiftPauseApprovalTick: 874_213_003,
  timeEntryAutoCloseTick: 874_213_004,
  volunteerDigestTick: 874_213_005,
} as const;
