export interface Recorder {
  name: string | null;
  onBehalf: boolean;
}

interface RecorderEntry {
  volunteer?: { id: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
}

/**
 * Describes who recorded a time entry for display: the recorder's name (or
 * null when unknown), and whether it was recorded on the volunteer's behalf
 * (an admin entry) rather than by the volunteer themselves.
 */
export function describeRecorder(entry: RecorderEntry): Recorder {
  const creator = entry.createdBy;
  if (!creator) {
    return { name: null, onBehalf: false };
  }
  return {
    name: creator.name || creator.email,
    onBehalf: creator.id !== entry.volunteer?.id,
  };
}
