import { createSearchParamsCache } from 'nuqs/server';
import { timesheetsSearchParams } from './timesheets-search-params';

export const timesheetsSearchParamsCache = createSearchParamsCache(
  timesheetsSearchParams,
);
