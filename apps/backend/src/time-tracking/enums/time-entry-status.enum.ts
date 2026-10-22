import { registerEnumType } from '@nestjs/graphql';

export enum TimeEntryStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  AUTO_CLOSED = 'AUTO_CLOSED',
}

registerEnumType(TimeEntryStatus, {
  name: 'TimeEntryStatus',
});
