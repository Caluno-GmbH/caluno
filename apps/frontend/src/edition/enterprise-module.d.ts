/**
 * Ambient types for the optional EE manifest (`@/ee` → `src/ee`).
 * Private checkouts have the real module; OSS mirrors strip `src/ee`.
 * This declaration keeps `import('@/ee')` / `import('@/ee/nav')` /
 * `import('@/ee/count-badges')` typecheckable when absent. When `src/ee`
 * exists, keep the public exports aligned with these shapes.
 */
declare module '@/ee' {
  import type { EeExtensions } from './enterprise-extensions';
  export const eeExtensions: EeExtensions;
}

declare module '@/ee/count-badges' {
  import type { ComponentType } from 'react';
  import type { EeCountBadgeName } from './enterprise-menu-extensions';
  export const eeCountBadges: Record<EeCountBadgeName, ComponentType>;
}
