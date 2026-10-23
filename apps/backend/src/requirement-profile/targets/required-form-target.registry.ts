import { Injectable } from '@nestjs/common';
import { ConflictGraphQLError } from '../../graphql/errors';
import { RequiredFormTargetType } from '../enums';
import { EventRequiredFormTargetStrategy } from './event-required-form-target.strategy';
import { OrganizationUnitRequiredFormTargetStrategy } from './organization-unit-required-form-target.strategy';
import type { RequiredFormTargetStrategy } from './required-form-target.strategy';
import { ShiftInstanceRequiredFormTargetStrategy } from './shift-instance-required-form-target.strategy';
import { ShiftRequiredFormTargetStrategy } from './shift-required-form-target.strategy';

@Injectable()
export class RequiredFormTargetRegistry {
  private readonly byType: Map<
    RequiredFormTargetType,
    RequiredFormTargetStrategy
  >;

  constructor(
    organizationUnit: OrganizationUnitRequiredFormTargetStrategy,
    event: EventRequiredFormTargetStrategy,
    shift: ShiftRequiredFormTargetStrategy,
    shiftInstance: ShiftInstanceRequiredFormTargetStrategy,
  ) {
    this.byType = new Map<RequiredFormTargetType, RequiredFormTargetStrategy>([
      [organizationUnit.targetType, organizationUnit],
      [event.targetType, event],
      [shift.targetType, shift],
      [shiftInstance.targetType, shiftInstance],
    ]);
  }

  get(targetType: RequiredFormTargetType): RequiredFormTargetStrategy {
    const strategy = this.byType.get(targetType);
    if (!strategy) {
      throw new ConflictGraphQLError(
        `Unsupported required-form target: ${targetType}`,
      );
    }
    return strategy;
  }
}
