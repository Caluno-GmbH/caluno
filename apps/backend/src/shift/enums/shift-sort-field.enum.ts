import { registerEnumType } from '@nestjs/graphql';

export enum ShiftSortField {
  TITLE = 'TITLE',
  FIRST_DATE = 'FIRST_DATE',
  VISIBILITY = 'VISIBILITY',
  CREATED_AT = 'CREATED_AT',
}

registerEnumType(ShiftSortField, {
  name: 'ShiftSortField',
});
