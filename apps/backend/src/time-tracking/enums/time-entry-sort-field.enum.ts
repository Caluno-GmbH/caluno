import { registerEnumType } from '@nestjs/graphql';

export enum TimeEntrySortField {
  SHIFT = 'SHIFT',
  VOLUNTEER = 'VOLUNTEER',
  STARTED_AT = 'STARTED_AT',
  DURATION = 'DURATION',
  CREATED_AT = 'CREATED_AT',
}

registerEnumType(TimeEntrySortField, {
  name: 'TimeEntrySortField',
});
