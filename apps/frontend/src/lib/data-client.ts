import { createDataClient, type DataClient } from '@repo/data';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { GRAPHQL_API_URL } from './constants';
import { createGetDataClient } from './data-client-core';

const globalForData = globalThis as unknown as {
  dataClient: DataClient | undefined;
};

export const data =
  globalForData.dataClient ??
  createDataClient({
    url: `${GRAPHQL_API_URL}`,
    credentials: 'include',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForData.dataClient = data;
}

export const getDataClient = createGetDataClient({
  createDataClient,
  getLocale,
  getHeaders: headers,
  redirect,
});
