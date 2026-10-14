import { registerEnumType } from '@nestjs/graphql';

export enum TodoFillThreshold {
  BELOW_MINIMUM = 'BELOW_MINIMUM',
  NOT_FULL = 'NOT_FULL',
}

registerEnumType(TodoFillThreshold, {
  name: 'TodoFillThreshold',
});
