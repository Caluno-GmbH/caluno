import { Field, InputType } from '@nestjs/graphql';
import { IsIn, IsString } from 'class-validator';

@InputType()
export class AcceptTermsInput {
  @Field(() => String)
  @IsString()
  version!: string;

  @Field(() => String)
  @IsIn(['en', 'de'])
  language!: string;
}
