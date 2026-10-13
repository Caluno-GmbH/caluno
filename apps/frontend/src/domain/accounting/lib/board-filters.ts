import type { PauschalenType } from '../components/doc-type-header';
import type { DateRange } from '../components/period-picker';
import type {
  BoardDocument,
  BoardVolunteer,
  DocStatus,
  TileFilter,
} from './board-types';

/**
 * A timesheet is non-compliant when no active contract exists for its pauschale type —
 * contracts must be active before a timesheet can be created. Derived, not stored, so it
 * always reflects the volunteer's current contract state.
 */
export function isTimesheetNonCompliant(
  vol: BoardVolunteer,
  doc: BoardDocument,
): boolean {
  if (!doc.status.startsWith('timesheet')) return false;
  // Declined is a terminal dead end on its own — reissuing is the fix, not
  // the paired contract, so it never carries the non-compliant flag too.
  if (doc.status === 'timesheet-declined') return false;
  const pauschale = doc.pauschale;
  return !vol.documents.some(
    (d) => d.status === 'contract-active' && d.pauschale === pauschale,
  );
}

function findContractDoc(
  vol: BoardVolunteer,
  pauschale: PauschalenType,
): BoardDocument | undefined {
  return vol.documents.find(
    (d) => d.status.startsWith('contract') && d.pauschale === pauschale,
  );
}

/**
 * The last instant of a day. A range picked as "1 – 30 September" ends at
 * midnight on the 30th, which would exclude everything that happened during
 * that day — the whole of the last day of the selected period.
 */
function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

/**
 * Whether a timesheet belongs to the selected period.
 *
 * Matched on the period the document covers, not on when it was last touched.
 * A timesheet for August countersigned in September is an August document, and
 * asking for August has to find it — it used to be judged by `lastActionDate`,
 * so it went missing from its own month and turned up in the next one
 * (VOLI-1543).
 *
 * A document with no period of its own is never hidden: the filter narrows
 * what is shown, and cannot decide about something it has no date for.
 */
function docInRange(doc: BoardDocument, range: DateRange | undefined): boolean {
  if (!range?.from) return true;
  const start = doc.periodStart;
  if (!start) return true;
  const end = doc.periodEnd ?? start;
  return start <= endOfDay(range.to ?? range.from) && end >= range.from;
}

/** A contract's `periodLabel` is its coverage year (e.g. "2026"); a timesheet's is "<Month> <year>" — either way the year is the last 4 digits. */
function periodYear(doc: BoardDocument): string | undefined {
  return doc.periodLabel.match(/\d{4}/)?.[0];
}

/** Contracts run the calendar year, so they're "in range" whenever their year overlaps the selected period — never by the exact day they were signed. */
function contractCoversRange(doc: BoardDocument, range: DateRange): boolean {
  const year = periodYear(doc);
  if (!year || !range.from) return true;
  const fromYear = range.from.getFullYear();
  const toYear = (range.to ?? range.from).getFullYear();
  const y = Number(year);
  return y >= fromYear && y <= toYear;
}

/**
 * Display-time date filter for a document. Contracts are annual — active for
 * every month of their year — so they never get hidden by an exact-day
 * range; timesheets still match by their own date. Never mutates the
 * volunteer's document list (see `applyFilters`) — this only decides what to
 * render, so compliance checks keep seeing the true, unfiltered data.
 */
export function docVisibleInRange(
  doc: BoardDocument,
  range: DateRange | undefined,
): boolean {
  if (!range?.from) return true;
  if (doc.status.startsWith('contract')) return contractCoversRange(doc, range);
  return docInRange(doc, range);
}

/**
 * Row set for the "Ready to go" tab: only the ready timesheets (date-scoped)
 * plus, per pauschale type they cover, that type's real contract document —
 * whatever its status, so an in-progress signing keeps its normal action —
 * or a synthesized, greyed `contract-missing` placeholder for the
 * timesheet's year when no contract exists at all. Every other document
 * (generate/signing docs from other periods) is excluded, so nothing but the
 * bundle-download action and this one placeholder's "Create" can surface
 * here.
 */
export function getReadyToGoDocs(
  volunteer: BoardVolunteer,
  range: DateRange | undefined,
): BoardDocument[] {
  const readyTimesheets = volunteer.documents.filter(
    (d) => d.status === 'timesheet-ready' && docInRange(d, range),
  );
  if (readyTimesheets.length === 0) return [];

  const pauschaleTypes = Array.from(
    new Set(readyTimesheets.map((d) => d.pauschale)),
  );

  const contractRows: BoardDocument[] = pauschaleTypes.map((type) => {
    const contract = findContractDoc(volunteer, type);
    if (contract) return contract;

    const sample = readyTimesheets.find((d) => d.pauschale === type);
    const year = (sample && periodYear(sample)) ?? '';
    return {
      id: `${volunteer.id}-contract-missing-${type}-${year}`,
      status: 'contract-missing',
      periodLabel: year,
      pauschale: type,
    };
  });

  return [...readyTimesheets, ...contractRows];
}

export function matchesTile(status: DocStatus, tile: TileFilter): boolean {
  switch (tile) {
    case 'all':
      return true;
    case 'contract-generate':
      return status === 'contract-generate' || status === 'contract-draft';
    case 'contract-signing':
      return (
        status === 'contract-signing-vol' || status === 'contract-signing-coord'
      );
    case 'timesheet-generate':
      return status === 'timesheet-generate';
    case 'timesheet-signing':
      return (
        status === 'timesheet-signing-vol' ||
        status === 'timesheet-signing-super'
      );
    case 'ready-to-go':
      return status === 'timesheet-ready';
  }
}
