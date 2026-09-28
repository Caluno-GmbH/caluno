import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ReimbursementTypeKey } from '../enums';

@ObjectType()
export class AccountingTemplateSlotStatus {
  @Field(() => ID)
  reimbursementTypeId!: string;

  @Field(() => ReimbursementTypeKey)
  reimbursementTypeKey!: ReimbursementTypeKey;

  @Field(() => Boolean)
  hasContractTemplate!: boolean;

  @Field(() => Boolean)
  hasInvoiceTemplate!: boolean;

  @Field(() => Boolean)
  ready!: boolean;
}

/** The org details documents for this unit render, inherited from parent units where blank. */
@ObjectType()
export class AccountingOrgProfile {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  address!: string | null;

  @Field(() => String, { nullable: true })
  city!: string | null;

  @Field(() => String, { nullable: true })
  zipCode!: string | null;

  @Field(() => String, { nullable: true })
  legalRep!: string | null;
}

@ObjectType()
export class AccountingSetupStatus {
  @Field(() => AccountingOrgProfile, { nullable: true })
  orgProfile!: AccountingOrgProfile | null;

  @Field(() => Boolean)
  orgProfileComplete!: boolean;

  @Field(() => [String])
  missingOrgProfileFields!: string[];

  @Field(() => [AccountingTemplateSlotStatus])
  slots!: AccountingTemplateSlotStatus[];

  @Field(() => Boolean)
  canManageTemplates!: boolean;

  @Field(() => Boolean)
  canCreateDocuments!: boolean;
}
