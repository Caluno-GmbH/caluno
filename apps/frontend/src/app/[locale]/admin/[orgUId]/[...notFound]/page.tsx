import { notFound } from 'next/navigation';

/**
 * Unmatched paths under `/admin/[orgUId]` never hit the segment
 * `not-found.tsx` on their own — Next only uses that file when `notFound()`
 * is called. This catch-all turns unknown URLs into a matched route that
 * triggers `../not-found.tsx`.
 */
export default function AdminCatchAllNotFound() {
  notFound();
}
