import { InputType, OmitType } from '@nestjs/graphql';
import { CreateShiftInput } from './create-shift.input';

@InputType()
export class DuplicateShiftInput extends OmitType(CreateShiftInput, [
  'invitedMemberIds',
] as const) {}
