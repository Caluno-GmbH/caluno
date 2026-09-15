import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { ReimbursementType } from './reimbursement-type.model';

@ObjectType()
export class EffectiveRate {
  @Field(() => ReimbursementType)
  reimbursementType!: ReimbursementType;

  @Field(() => Int)
  hourlyRateCents!: number;

  @Field(() => Boolean)
  isOverride!: boolean;

  /**
   * What this unit would fall back to if it set no rate of its own: its
   * nearest ancestor's rate, or the platform default above them all. Also
   * populated when the unit does override — it is then the rate the
   * override replaces.
   */
  @Field(() => Int)
  fallbackRateCents!: number;

  /** True when this unit set the rate itself rather than inheriting it. */
  @Field(() => Boolean)
  isOwnRate!: boolean;

  /** The ancestor unit an inherited rate comes from, for attribution. */
  @Field(() => String, { nullable: true })
  sourceUnitName?: string | null;

  @Field(() => ID, { nullable: true })
  organizationUnitId?: string | null;
}
