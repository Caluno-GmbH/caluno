export type HeaderCheckedState = boolean | 'indeterminate';

export function headerCheckedState(
  visibleIds: string[],
  selectedIds: ReadonlySet<string>,
): HeaderCheckedState {
  if (visibleIds.length === 0) return false;
  const hits = visibleIds.filter((id) => selectedIds.has(id)).length;
  if (hits === 0) return false;
  return hits === visibleIds.length ? true : 'indeterminate';
}

export function toggleVisible(
  visibleIds: string[],
  selectedIds: ReadonlySet<string>,
): Set<string> {
  const next = new Set(selectedIds);
  const allSelected = visibleIds.every((id) => next.has(id));
  for (const id of visibleIds) {
    if (allSelected) next.delete(id);
    else next.add(id);
  }
  return next;
}

export function joinEmails(emails: string[]): string {
  return emails.join(', ');
}
