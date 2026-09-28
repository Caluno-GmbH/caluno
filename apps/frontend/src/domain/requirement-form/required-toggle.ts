import { FieldType } from '@repo/data';

/**
 * Whether the block editor may toggle a field between optional and required.
 * Info text (StaticText) renders no input and carries no answer, so it can
 * never be required
 */
export type RequiredToggleState =
  | { disabled: false }
  | { disabled: true; reasonKey: 'requiredFixedInfoText' };

export const requiredToggleState = (
  type: string | FieldType | undefined | null,
): RequiredToggleState =>
  type === FieldType.StaticText
    ? { disabled: true, reasonKey: 'requiredFixedInfoText' }
    : { disabled: false };
