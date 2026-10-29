import type { GetTimeEntriesQuery } from '@repo/data';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

export function formatAddress(orgUnit: {
  street?: string | null;
  zipCode?: string | null;
  city?: string | null;
}): string | null {
  const parts = [orgUnit.street, orgUnit.zipCode, orgUnit.city].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

export function sumDurationMinutes(
  entries: { startedAt: string; endedAt?: string | null }[],
): number {
  return entries.reduce((total, entry) => {
    if (!entry.endedAt) return total;
    const minutes =
      (new Date(entry.endedAt).getTime() - new Date(entry.startedAt).getTime()) /
      60_000;
    return total + Math.round(minutes);
  }, 0);
}

export function resolveTimeEntryLocation(entry: {
  shiftInstance?: {
    overrideLocation?: string | null;
    master: { location?: string | null };
  } | null;
  organizationUnit: { street?: string | null; zipCode?: string | null; city?: string | null };
}): string | null {
  if (entry.shiftInstance) {
    return (
      entry.shiftInstance.overrideLocation ??
      entry.shiftInstance.master.location ??
      null
    );
  }
  return formatAddress(entry.organizationUnit);
}
