import { Field, Int, ObjectType } from '@nestjs/graphql';
import { RequiredFormTargetType } from '../enums';

@ObjectType()
export class RequirementFormDeleteAttachment {
  @Field(() => RequiredFormTargetType)
  targetType!: RequiredFormTargetType;

  @Field(() => String)
  targetId!: string;

  @Field(() => String)
  name!: string;
}

@ObjectType()
export class RequirementFormDeleteImpact {
  @Field(() => Int)
  submissionCount!: number;

  @Field(() => [RequirementFormDeleteAttachment])
  attachments!: RequirementFormDeleteAttachment[];
}
