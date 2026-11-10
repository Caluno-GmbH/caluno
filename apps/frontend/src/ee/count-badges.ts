'use client';

import type { ComponentType } from 'react';
import type { EeCountBadgeName } from '@/edition/enterprise-menu-extensions';
import { TodoNavCountBadge } from './todo/todo-nav-count-badge';

/**
 * Client-only EE nav badge registry. Keys match `EeCountBadgeName`;
 * the sidebar loads this module dynamically so OSS builds never import it.
 */
export const eeCountBadges: Record<EeCountBadgeName, ComponentType> = {
  todo: TodoNavCountBadge,
};
