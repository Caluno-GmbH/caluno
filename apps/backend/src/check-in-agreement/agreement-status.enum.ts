import { registerEnumType } from '@nestjs/graphql';

export enum AgreementStatus {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  NO_TEMPLATE = 'NO_TEMPLATE',
  NO_CONTRACT = 'NO_CONTRACT',
  AWAITING_VOLUNTEER_SIGNATURE = 'AWAITING_VOLUNTEER_SIGNATURE',
  AWAITING_COUNTERSIGNATURE = 'AWAITING_COUNTERSIGNATURE',
  ACTIVE = 'ACTIVE',
}

registerEnumType(AgreementStatus, {
  name: 'AgreementStatus',
});
