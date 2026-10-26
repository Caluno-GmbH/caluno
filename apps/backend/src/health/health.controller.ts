import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { DatabaseHealthIndicator } from './database.health';

/**
 * Probe endpoints for Scaleway Serverless Containers.
 *
 * `live` must not depend on any collaborator: a failing liveness probe
 * restarts the container, which would not fix a database outage.
 * `ready` checks the dependencies required to serve requests and backs the
 * startup probe, so traffic is withheld from half-started instances. It also
 * reports the running commit, so a deploy check can tell a new revision from
 * the previous one that keeps serving while the new one fails to start.
 */
@AllowAnonymous()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  async ready() {
    const result = await this.health.check([
      () => this.database.pingCheck('database'),
    ]);
    return { ...result, release: process.env.SENTRY_RELEASE };
  }
}
