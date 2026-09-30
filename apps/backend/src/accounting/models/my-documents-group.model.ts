import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Contract } from './contract.model';
import { Invoice } from './invoice.model';

/**
 * One org-unit's worth of the volunteer's documents, as seen on the
 * cross-org "My documents" page. Grouped by membership/org unit so documents
 * issued in different units of the same org stay separate.
 */
@ObjectType()
export class MyDocumentsGroup {
  /** One of the volunteer's memberships in this org — used to route previews. */
  @Field(() => ID)
  membershipId!: string;

  @Field(() => ID)
  organizationUnitId!: string;

  @Field(() => String)
  organizationUnitName!: string;

  @Field(() => String)
  organizationName!: string;

  @Field(() => String, { nullable: true })
  logoUrl?: string | null;

  @Field(() => [Contract])
  contracts!: Contract[];

  @Field(() => [Invoice])
  invoices!: Invoice[];
}
