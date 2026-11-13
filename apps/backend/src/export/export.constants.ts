/**
 * Hard bounds for a single export request. They keep one GraphQL call from
 * turning into an unbounded number of database reads and an unbounded file.
 */
export const MAX_EXPORT_ROW_IDS = 5_000;
export const MAX_EXPORT_COLUMNS = 50;
export const MAX_EXPORT_LOG_PAGE_SIZE = 200;
export const DEFAULT_EXPORT_LOG_PAGE_SIZE = 50;
export const EXPORT_MIME_TYPE = 'text/csv';
