import { createSearchParamsCache } from 'nuqs/server';
import { shiftsSearchParams } from './shifts-search-params';

export const shiftsSearchParamsCache =
  createSearchParamsCache(shiftsSearchParams);
