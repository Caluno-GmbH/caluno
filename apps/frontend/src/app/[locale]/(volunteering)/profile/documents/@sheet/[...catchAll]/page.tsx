/**
 * Closes the @sheet slot on soft navigation: without a matching page Next
 * keeps the last active sheet mounted (only `default.tsx` applies on hard
 * loads), so leaving the complete-profile route would leave it in the tree.
 */
export default function SheetCatchAllPage() {
  return null;
}
