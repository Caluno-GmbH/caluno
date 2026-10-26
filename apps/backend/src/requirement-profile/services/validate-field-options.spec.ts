import { BadRequestGraphQLError } from '../../graphql/errors';
import { FieldType } from '../enums';
import {
  assertValidFieldOptions,
  assertValidProfileKeyBinding,
  assertValidRequiredFlag,
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

  it('throws for duplicate options', () => {
    expect(() =>
      assertValidFieldOptions(FieldType.SINGLE_CHOICE, ['Morning', 'Morning']),
    ).toThrow(BadRequestGraphQLError);
  });

  it('throws for duplicates that only differ by surrounding whitespace', () => {
    expect(() =>
      assertValidFieldOptions(FieldType.MULTI_CHOICE, ['Morning', ' Morning ']),
    ).toThrow(BadRequestGraphQLError);
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

describe('assertValidProfileKeyBinding', () => {
  it('accepts a gender single-choice field without options', () => {
    expect(() =>
      assertValidProfileKeyBinding('gender', FieldType.SINGLE_CHOICE, null),
    ).not.toThrow();
    expect(() =>
      assertValidProfileKeyBinding('gender', FieldType.SINGLE_CHOICE, []),
    ).not.toThrow();
  });

  it('rejects a gender field with a non-choice type', () => {
    expect(() =>
      assertValidProfileKeyBinding('gender', FieldType.TEXT, null),
    ).toThrow(BadRequestGraphQLError);
    expect(() =>
      assertValidProfileKeyBinding('gender', FieldType.MULTI_CHOICE, null),
    ).toThrow(BadRequestGraphQLError);
  });

  it('rejects a gender field with custom options', () => {
    expect(() =>
      assertValidProfileKeyBinding('gender', FieldType.SINGLE_CHOICE, [
        'Female',
      ]),
    ).toThrow(BadRequestGraphQLError);
  });

  it('ignores other profile keys and missing keys', () => {
    expect(() =>
      assertValidProfileKeyBinding('firstname', FieldType.TEXT, null),
    ).not.toThrow();
    expect(() =>
      assertValidProfileKeyBinding(null, FieldType.TEXT, null),
    ).not.toThrow();
    expect(() =>
      assertValidProfileKeyBinding(undefined, FieldType.SINGLE_CHOICE, ['A']),
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
