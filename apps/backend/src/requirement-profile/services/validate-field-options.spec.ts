import { BadRequestGraphQLError } from '../../graphql/errors';
import { FieldType } from '../enums';
import {
  assertValidFieldOptions,
  assertValidRequiredFlag,
  assertValidSystemKeyBinding,
} from './validate-field-options';

describe('assertValidFieldOptions', () => {
  it('throws for a MULTI_CHOICE option that is empty', () => {
    expect(() =>
      assertValidFieldOptions(FieldType.MULTI_CHOICE, ['10:30', '']),
    ).toThrow(BadRequestGraphQLError);
  });

  it('throws for a SINGLE_CHOICE option that is blank', () => {
    expect(() =>
      assertValidFieldOptions(FieldType.SINGLE_CHOICE, ['Morning', '   ']),
    ).toThrow(BadRequestGraphQLError);
  });

  it('accepts valid options', () => {
    expect(() =>
      assertValidFieldOptions(FieldType.MULTI_CHOICE, ['10:30', '13:00']),
    ).not.toThrow();
  });

  it('ignores non-choice field types even with empty options', () => {
    expect(() => assertValidFieldOptions(FieldType.TEXT, [''])).not.toThrow();
  });

  it('ignores missing options', () => {
    expect(() =>
      assertValidFieldOptions(FieldType.MULTI_CHOICE, null),
    ).not.toThrow();
    expect(() =>
      assertValidFieldOptions(FieldType.MULTI_CHOICE, undefined),
    ).not.toThrow();
  });
});

describe('assertValidSystemKeyBinding', () => {
  it('accepts a gender single-choice field without options', () => {
    expect(() =>
      assertValidSystemKeyBinding('gender', FieldType.SINGLE_CHOICE, null),
    ).not.toThrow();
    expect(() =>
      assertValidSystemKeyBinding('gender', FieldType.SINGLE_CHOICE, []),
    ).not.toThrow();
  });

  it('rejects a gender field with a non-choice type', () => {
    expect(() =>
      assertValidSystemKeyBinding('gender', FieldType.TEXT, null),
    ).toThrow(BadRequestGraphQLError);
    expect(() =>
      assertValidSystemKeyBinding('gender', FieldType.MULTI_CHOICE, null),
    ).toThrow(BadRequestGraphQLError);
  });

  it('rejects a gender field with custom options', () => {
    expect(() =>
      assertValidSystemKeyBinding('gender', FieldType.SINGLE_CHOICE, [
        'Female',
      ]),
    ).toThrow(BadRequestGraphQLError);
  });

  it('ignores other system keys and missing keys', () => {
    expect(() =>
      assertValidSystemKeyBinding('firstname', FieldType.TEXT, null),
    ).not.toThrow();
    expect(() =>
      assertValidSystemKeyBinding(null, FieldType.TEXT, null),
    ).not.toThrow();
    expect(() =>
      assertValidSystemKeyBinding(undefined, FieldType.SINGLE_CHOICE, ['A']),
    ).not.toThrow();
  });
});

describe('assertValidRequiredFlag', () => {
  it('rejects a required static text field', () => {
    expect(() => assertValidRequiredFlag(FieldType.STATIC_TEXT, true)).toThrow(
      BadRequestGraphQLError,
    );
  });

  it('accepts an optional static text field', () => {
    expect(() =>
      assertValidRequiredFlag(FieldType.STATIC_TEXT, false),
    ).not.toThrow();
    expect(() =>
      assertValidRequiredFlag(FieldType.STATIC_TEXT, null),
    ).not.toThrow();
    expect(() =>
      assertValidRequiredFlag(FieldType.STATIC_TEXT, undefined),
    ).not.toThrow();
  });

  it('accepts required on any other field type', () => {
    for (const fieldType of Object.values(FieldType).filter(
      (type) => type !== FieldType.STATIC_TEXT,
    )) {
      expect(() => assertValidRequiredFlag(fieldType, true)).not.toThrow();
    }
  });
});
