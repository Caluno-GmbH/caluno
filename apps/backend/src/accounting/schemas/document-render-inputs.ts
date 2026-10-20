/**
 * What a document's PDF shows besides its own body: the resolved field values
 * (volunteer, organisation, amounts, letterhead) and, for a timesheet, the rows
 * of its time-entry table. Frozen when the volunteer signs, so a PDF rendered
 * later (a retry, a bundle download) shows what was signed rather than what the
 * profiles, templates or time entries say today.
 */
export interface DocumentRenderInputs {
  values: Record<string, string>;
  tableRows?: string[][];
}
