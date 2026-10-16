import { Field, ID, ObjectType } from '@nestjs/graphql';
import { VolunteerAllowanceState } from '../services/volunteer-allowance';

@ObjectType()
export class VolunteerAllowance {
  @Field(() => ID)
  volunteerId!: string;

  @Field(() => VolunteerAllowanceState)
  state!: VolunteerAllowanceState;
}
