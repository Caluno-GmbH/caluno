import { BadRequestGraphQLError } from '../../graphql/errors';
import { GENDER_SYSTEM_KEY } from '../constants';
import { FieldType } from '../enums';

const CHOICE_TYPES: ReadonlySet<FieldType> = new Set([
  FieldType.SINGLE_CHOICE,
  FieldType.MULTI_CHOICE,
]);

export interface FieldOptionInput {
  label: string;
  value: string;
}

/**
 * Choice fields render one control per option value; an empty value can never
 * stay selected on the volunteer form, so reject it at write time.
 */
export function assertValidFieldOptions(
  type: FieldType,
  options: FieldOptionInput[] | null | undefined,
): void {
  if (!CHOICE_TYPES.has(type) || !options) return;

  for (const option of options) {
    if (!option.label?.trim() || !option.value?.trim()) {
      throw new BadRequestGraphQLError(
        'Choice field options must have a non-empty label and value',
      );
    }
  }
}

/**
 * Gender is a fixed single-choice system field: rows carry empty options and
 * rendering/validation inject the fixed list by systemKey (VOLI-1267).
 * Reject field configurations that break that contract.
 */
export function assertValidSystemKeyBinding(
  systemKey: string | null | undefined,
  type: FieldType,
  options: FieldOptionInput[] | null | undefined,
): void {
  if (systemKey !== GENDER_SYSTEM_KEY) return;

  if (type !== FieldType.SINGLE_CHOICE) {
    throw new BadRequestGraphQLError(
      'The gender system field must be of type SINGLE_CHOICE',
    );
  }
  if (options && options.length > 0) {
    throw new BadRequestGraphQLError(
      'The gender system field uses fixed options and cannot define custom options',
    );
  }
}

export function assertValidRequiredFlag(
  type: FieldType,
  required: boolean | null | undefined,
): void {
  if (required === true && type === FieldType.STATIC_TEXT) {
    throw new BadRequestGraphQLError(
      'Info text fields carry no answer and cannot be required',
    );
  }
}
