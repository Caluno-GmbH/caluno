/**
 * Serializable EE nav badge keys. Contribution descriptors carry a name
 * (safe across the RSC → client boundary); the client resolves it via
 * `@/ee/count-badges` when EE is present. Add a key here when a new EE
 * nav item needs a count badge.
 */
export type EeCountBadgeName = 'todo';
