import { notFound } from 'next/navigation';

/**
 * Unmatched paths under `/admin/[orgUId]` never hit the segment
 * `not-found.tsx` on their own — Next only uses that file when `notFound()`
 * is called. This catch-all turns unknown URLs into a matched route that
 * triggers `../not-found.tsx`.
 *
 * Every `@sheet` path must also have a children stub (`null`) so this
 * catch-all does not steal those URLs on soft-nav.
 */
export default function AdminCatchAllNotFound() {
  notFound();
}
