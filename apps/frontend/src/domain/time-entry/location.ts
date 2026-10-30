export function formatAddress(orgUnit: {
  street?: string | null;
  zipCode?: string | null;
  city?: string | null;
}): string | null {
  const parts = [orgUnit.street, orgUnit.zipCode, orgUnit.city].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

export function entryDurationMinutes(entry: {
  startedAt: string;
  endedAt?: string | null;
}): number | null {
  if (!entry.endedAt) return null;
  return Math.round(
    (new Date(entry.endedAt).getTime() - new Date(entry.startedAt).getTime()) /
      60_000,
  );
}

export function sumDurationMinutes(
  entries: { startedAt: string; endedAt?: string | null }[],
): number {
  return entries.reduce((total, entry) => {
    const minutes = entryDurationMinutes(entry);
    return minutes !== null ? total + minutes : total;
  }, 0);
}

export function resolveTimeEntryLocation(entry: {
  shiftInstance?: {
    overrideLocation?: string | null;
    master: { location?: string | null };
  } | null;
  organizationUnit: {
    street?: string | null;
    zipCode?: string | null;
    city?: string | null;
  };
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
