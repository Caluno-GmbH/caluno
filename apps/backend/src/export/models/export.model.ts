import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ExportTable } from '../enums';

@ObjectType()
export class ExportFile {
  @Field(() => String)
  filename!: string;

  @Field(() => String)
  content!: string;
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
export class ExportTableInput {
  @Field(() => ExportTable)
  tableKind!: ExportTable;

  @Field(() => [ID])
  rowIds!: string[];

  @Field(() => [String])
  columns!: string[];

  @Field(() => Boolean)
  includeTechnicalIds!: boolean;
}
