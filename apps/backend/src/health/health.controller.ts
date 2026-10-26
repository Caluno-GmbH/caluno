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
 * startup probe, so traffic is withheld from half-started instances.
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
  ready() {
    return this.health.check([() => this.database.pingCheck('database')]);
  }
}
