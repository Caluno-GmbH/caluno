import { Field, ObjectType } from '@nestjs/graphql';
import { OrganizationUnit } from '../../organization/models/organization-unit.model';
import { User } from '../../user/models/user.model';
import { TimeEntry } from './time-entry.model';

@ObjectType()
export class CheckInContext {
  // Null when the volunteer is unrelated to every unit the caller manages.
  @Field(() => User, { nullable: true })
  volunteer!: User | null;

  @Field(() => [OrganizationUnit])
  eligibleOrganizationUnits!: OrganizationUnit[];

  @Field(() => [OrganizationUnit])
  pendingOrganizationUnits!: OrganizationUnit[];

  @Field(() => [TimeEntry])
  openTimeEntries!: TimeEntry[];
}
