import { describe, expect, it } from 'bun:test';
import type { HealthIndicatorService } from '@nestjs/terminus';
import type { DatabasePoolService } from '../database/database.module';
import { DatabaseHealthIndicator } from './database.health';

const indicatorService = {
  check: () => ({
    up: () => ({ database: { status: 'up' } }),
    down: (data: unknown) => ({
      database: { status: 'down', ...(data as object) },
    }),
  }),
} as unknown as HealthIndicatorService;

type FakePool = {
  waitingCount: number;
  query: (sql: string) => Promise<unknown>;
};

const build = ({ query, waitingCount }: FakePool) =>
  new DatabaseHealthIndicator(
    {
      pool: {
        waitingCount,
        connect: async () => ({ query, release: () => {} }),
      },
    } as unknown as DatabasePoolService,
    indicatorService,
  );

describe('DatabaseHealthIndicator', () => {
  it('is up when the ping succeeds', async () => {
    const result = await build({
      waitingCount: 0,
      query: async () => ({}),
    }).pingCheck('database');
    expect(result.database.status).toBe('up');
  });

  it('is down with a generic message when the ping fails', async () => {
    const result = await build({
      waitingCount: 0,
      query: async (sql) => {
        if (sql === 'select 1') {
          throw new Error('connect ECONNREFUSED 10.0.0.5:5432');
        }
        return {};
      },
    }).pingCheck('database');
    expect(result.database).toEqual({ status: 'down', message: 'unavailable' });
  });

  it('is down without querying when the pool is saturated', async () => {
    let queried = false;
    const result = await build({
      waitingCount: 2,
      query: async () => {
        queried = true;
        return {};
      },
    }).pingCheck('database');
    expect(result.database.status).toBe('down');
    expect(queried).toBe(false);
  });
});
