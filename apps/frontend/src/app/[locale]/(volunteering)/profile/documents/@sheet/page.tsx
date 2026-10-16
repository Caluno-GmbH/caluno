/**
 * Closes the @sheet slot on soft navigation back to the documents list:
 * without a matching page Next keeps the last active sheet mounted (only
 * `default.tsx` applies on hard loads). A catch-all here is invalid under
 * Next's strict parallel-route matching — it has no sibling children page.
 */
export default function SheetIndexPage() {
  return null;
}
