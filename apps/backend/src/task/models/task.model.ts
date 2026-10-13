import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { PermissionKey } from '../../auth/enums';
import { TaskType } from '../enums/task-type.enum';

@ObjectType()
export class Task {
  @Field(() => ID)
  id!: string;

  @Field(() => TaskType)
  type!: TaskType;

  @Field(() => String)
  link!: string;

  @Field(() => GraphQLJSON)
  data!: Record<string, unknown>;

  @Field(() => ID)
  organizationUnitId!: string;

  @Field(() => PermissionKey, { nullable: true })
  neededPermission?: PermissionKey | null;
}
