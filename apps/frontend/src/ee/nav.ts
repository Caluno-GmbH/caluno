import type {
  EeExtensions,
  EeNavContext,
} from '@/edition/enterprise-extensions';
import { todoNavContributions } from './todo/todo-nav';

/**
 * Client-safe EE nav entry. The sidebar dynamically imports this module —
 * keep it free of Server Component / `next/headers` dependencies. Full
 * `eeExtensions` (including server page slots) lives in `./index`.
 */
export const eeNav: NonNullable<EeExtensions['nav']> = ({
  orgUId,
}: EeNavContext) => todoNavContributions(orgUId);
