import { Field, InputType, Int } from '@nestjs/graphql';
import { Weekday } from '../../shared/enums/weekday.enum';

@InputType()
export class UpdateOrganizationUnitAutomationInput {
  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;

  @Field(() => [Weekday], { nullable: true })
  activeDays?: Weekday[];

  @Field(() => Int, { nullable: true })
  leadTimeHours?: number | null;

  @Field(() => String, { nullable: true })
  sendAtTime?: string | null;
}
