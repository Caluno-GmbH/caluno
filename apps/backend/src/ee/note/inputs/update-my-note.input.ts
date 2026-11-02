import { Field, InputType } from '@nestjs/graphql';
import { IsString, MaxLength } from 'class-validator';

@InputType()
export class UpdateMyNoteInput {
  @Field(() => String)
  @IsString()
  @MaxLength(20_000)
  body!: string;
}
