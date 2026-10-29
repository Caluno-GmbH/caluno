import {
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseHealthIndicator } from '../src/health/database.health';
import { applyBunAuthMocks } from './helpers/auth-mocks';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

describe('Health probes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await getGraphqlTestContext());
  });

  it('reports liveness without authentication', async () => {
    const response = await request(app.getHttpServer()).get('/health/live');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('reports readiness with a reachable database', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body.info.database.status).toBe('up');
  });

  it('fails readiness but keeps liveness up when the database is unreachable', async () => {
    // Swapped on the indicator only, so background pool users are unaffected.
    const indicator = app.get(DatabaseHealthIndicator) as unknown as {
      poolService: unknown;
    };
    const original = indicator.poolService;
    indicator.poolService = {
      pool: {
        waitingCount: 0,
        connect: async () => {
          throw new Error('connect ECONNREFUSED 10.0.0.5:5432');
        },
      },
    };
    try {
      const ready = await request(app.getHttpServer()).get('/health/ready');
      expect(ready.status).toBe(503);
      expect(ready.body.error.database.status).toBe('down');
      expect(JSON.stringify(ready.body)).not.toContain('ECONNREFUSED');

      const live = await request(app.getHttpServer()).get('/health/live');
      expect(live.status).toBe(200);
    } finally {
      indicator.poolService = original;
    }
  });
});
