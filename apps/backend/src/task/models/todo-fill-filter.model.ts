import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { TodoFillThreshold } from '../enums/todo-fill-threshold.enum';

@ObjectType()
export class TodoFillAssignmentFilter {
  @Field(() => TodoFillThreshold)
  threshold!: TodoFillThreshold;

  @Field(() => Int)
  daysAhead!: number;
}

@InputType()
export class UpdateTodoFillAssignmentFilterInput {
  @Field(() => TodoFillThreshold)
  threshold!: TodoFillThreshold;

  @Field(() => Int)
  daysAhead!: number;
}
