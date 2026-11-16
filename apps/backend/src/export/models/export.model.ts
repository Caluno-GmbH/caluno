import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ExportTable } from '../enums';

@ObjectType()
export class ExportFile {
  @Field(() => String)
  filename!: string;

  /** Short-lived presigned GET; the CSV bytes never travel through GraphQL. */
  @Field(() => String)
  downloadUrl!: string;
}

@ObjectType()
export class ExportColumn {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  label!: string;
}

@ObjectType()
export class ExportLogEntry {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  actorName!: string;

  @Field(() => ExportTable)
  tableKind!: ExportTable;

  @Field(() => [String])
  columns!: string[];

  @Field(() => Boolean)
  includedTechnicalIds!: boolean;

  @Field(() => Int)
  rowCount!: number;

  @Field(() => [ID])
  subjectUserIds!: string[];

  @Field(() => Date)
  occurredAt!: Date;
}

@InputType()
export class ExportRowsInput {
  /**
   * Rows the caller selected (membership ids for USERS, time-entry ids for
   * TIMESHEETS, shift ids for SHIFTS). Rows outside the caller's unit — or its
   * descendants when `includeSubUnits` is set — are dropped.
   */
  @Field(() => [ID])
  rowIds!: string[];

  /** Column ids from the `exportColumns` query. Unknown ids are rejected. */
  @Field(() => [String])
  columns!: string[];

  @Field(() => Boolean, { defaultValue: false })
  includeTechnicalIds = false;

  /** Include rows from descendant organization units, not only the header unit. */
  @Field(() => Boolean, { defaultValue: false })
  includeSubUnits = false;
}
