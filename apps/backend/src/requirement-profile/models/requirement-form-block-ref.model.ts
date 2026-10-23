import { Field, ID, ObjectType } from '@nestjs/graphql';
import { FormBlock } from './form-block.model';

@ObjectType()
export class RequirementFormBlockRef {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  formId!: string;

  @Field(() => String)
  blockId!: string;

  @Field(() => Number)
  fieldOrder!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => FormBlock)
  block!: FormBlock;
}
