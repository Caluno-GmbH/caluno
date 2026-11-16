import { notFound } from 'next/navigation';

/**
 * Unknown URLs are handled here and render `../not-found.tsx`. Do not add
 * catch-alls under `admin/[orgUId]` — they compete with the `@sheet` slot
 * and turn sheet URLs into 404s.
 */
export default function LocaleCatchAllNotFound() {
  notFound();
}
