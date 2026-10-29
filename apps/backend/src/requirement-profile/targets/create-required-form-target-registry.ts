import type { Database } from '../../database/database.module';
import type { PostHogService } from '../../shared/observability/posthog.service';
import { EventRequiredFormTargetStrategy } from './event-required-form-target.strategy';
import { OrganizationUnitRequiredFormTargetStrategy } from './organization-unit-required-form-target.strategy';
import { RequiredFormTargetRegistry } from './required-form-target.registry';
import { RequiredFormWriteSupport } from './required-form-write-support';
import { ShiftInstanceRequiredFormTargetStrategy } from './shift-instance-required-form-target.strategy';
import { ShiftRequiredFormTargetStrategy } from './shift-required-form-target.strategy';

/** Manual wiring for unit tests that construct services with `new`. */
export function createRequiredFormTargetRegistry(
  db: Database,
  postHogService: PostHogService,
): RequiredFormTargetRegistry {
  const writeSupport = new RequiredFormWriteSupport(postHogService);
  return new RequiredFormTargetRegistry(
    new OrganizationUnitRequiredFormTargetStrategy(db, writeSupport),
    new EventRequiredFormTargetStrategy(db, writeSupport),
    new ShiftRequiredFormTargetStrategy(db, writeSupport),
    new ShiftInstanceRequiredFormTargetStrategy(db, writeSupport),
  );
}
