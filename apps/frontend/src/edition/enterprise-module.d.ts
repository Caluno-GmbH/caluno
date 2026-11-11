/**
 * Ambient types for the optional EE manifest (`@/ee` → `src/ee`).
 * Private checkouts have the real module; OSS mirrors strip `src/ee`.
 * This declaration keeps `import('@/ee')` typecheckable when absent.
 * When `src/ee` exists, keep the public export aligned with this shape.
 */
declare module '@/ee' {
  import type { EeExtensions } from './enterprise-extensions';
  export const eeExtensions: EeExtensions;
}
