import type {
  EeExtensions,
  EeNavContext,
} from '@/edition/enterprise-extensions';
import { todoNavContributions } from './todo/todo-nav';

/**
 * Serializable EE nav entry. The org layout calls this via `eeExtensions.nav`
 * and passes the result into the client sidebar. Keep free of Client Component
 * imports and `next/headers` — badges are string keys resolved client-side
 * from `@/ee/count-badges`. Full `eeExtensions` (including server page slots)
 * lives in `./index`.
 */
export const eeNav: NonNullable<EeExtensions['nav']> = ({
  orgUId,
}: EeNavContext) => todoNavContributions(orgUId);
