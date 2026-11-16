import { registerEnumType } from '@nestjs/graphql';

export enum ExportTable {
  TIMESHEETS = 'TIMESHEETS',
  USERS = 'USERS',
  SHIFTS = 'SHIFTS',
}

registerEnumType(ExportTable, {
  name: 'ExportTable',
});
