import { describe, expect, it } from 'bun:test';
import type { HealthCheckService } from '@nestjs/terminus';
import type { DatabaseHealthIndicator } from './database.health';
import { HealthController } from './health.controller';

const build = (pingCheck: DatabaseHealthIndicator['pingCheck']) => {
  const health = {
    check: async (indicators: Array<() => Promise<unknown>>) => {
      const results = await Promise.all(indicators.map((run) => run()));
      return { status: 'ok', results };
    },
  } as unknown as HealthCheckService;
  return new HealthController(health, {
    pingCheck,
  } as unknown as DatabaseHealthIndicator);
};

describe('HealthController', () => {
  it('liveness does not touch the database', async () => {
    let pinged = false;
    const controller = build(async () => {
      pinged = true;
      return {};
    });
    await controller.live();
    expect(pinged).toBe(false);
  });

  it('readiness checks the database', async () => {
    let pinged = false;
    const controller = build(async () => {
      pinged = true;
      return {};
    });
    await controller.ready();
    expect(pinged).toBe(true);
  });
});
