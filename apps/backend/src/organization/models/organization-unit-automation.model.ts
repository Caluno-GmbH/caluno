import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Weekday } from '../../shared/enums/weekday.enum';
import { OrganizationUnitAutomationKind } from '../enums';

@ObjectType()
export class OrganizationUnitAutomation {
  @Field(() => ID)
  organizationUnitId!: string;

  @Field(() => OrganizationUnitAutomationKind)
  kind!: OrganizationUnitAutomationKind;

  @Field(() => Boolean)
  enabled!: boolean;

  @Field(() => [Weekday])
  activeDays!: Weekday[];

  @Field(() => Int, { nullable: true })
  leadTimeHours?: number | null;

  @Field(() => String, { nullable: true })
  sendAtTime?: string | null;
}
