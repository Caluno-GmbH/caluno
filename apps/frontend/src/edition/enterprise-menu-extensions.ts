import { ListTodo } from 'lucide-react';

/**
 * Serializable EE admin-menu registries: icon names and count-badge keys
 * for `EeExtensions.nav` contributions. Descriptors carry names (safe
 * across the RSC → client boundary) rather than component references;
 * `mergeAdminNav` resolves icons via `EE_ICONS`, and the sidebar resolves
 * badges via `@/ee/count-badges` when EE is present.
 * A new EE nav item reusing an existing icon needs no change here; add a
 * badge key when a new EE nav item needs a count badge.
 */
export const EE_ICONS = {
  'list-todo': ListTodo,
} as const;

export type EeIconName = keyof typeof EE_ICONS;

/** lists all available EE count badges by name, so they can be resolved by name for the menu **/
export type EeCountBadgeName = 'todo';
