import { BadRequestGraphQLError } from '../../graphql/errors';
import { FieldType } from '../enums';
import {
  assertValidFieldOptions,
  assertValidSystemKeyBinding,
} from './validate-field-options';

describe('assertValidFieldOptions', () => {
  it('throws for a MULTI_CHOICE option with an empty value', () => {
    expect(() =>
      assertValidFieldOptions(FieldType.MULTI_CHOICE, [
        { label: '10:30', value: '' },
      ]),
    ).toThrow(BadRequestGraphQLError);
  });

  it('throws for a SINGLE_CHOICE option with a blank value', () => {
    expect(() =>
      assertValidFieldOptions(FieldType.SINGLE_CHOICE, [
        { label: 'Morning', value: '   ' },
      ]),
    ).toThrow(BadRequestGraphQLError);
  });

  it('throws for an option with an empty label', () => {
    expect(() =>
      assertValidFieldOptions(FieldType.MULTI_CHOICE, [
        { label: '', value: 'morning' },
      ]),
    ).toThrow(BadRequestGraphQLError);
  });

  it('accepts valid options', () => {
    expect(() =>
      assertValidFieldOptions(FieldType.MULTI_CHOICE, [
        { label: '10:30', value: '10:30' },
        { label: '13:00', value: '13:00' },
      ]),
    ).not.toThrow();
  });

  it('ignores non-choice field types even with empty option values', () => {
    expect(() =>
      assertValidFieldOptions(FieldType.TEXT, [{ label: '', value: '' }]),
    ).not.toThrow();
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
        { label: 'Female', value: 'female' },
      ]),
    ).toThrow(BadRequestGraphQLError);
  });

  it('ignores other system keys and missing keys', () => {
    expect(() =>
      assertValidSystemKeyBinding('name', FieldType.TEXT, null),
    ).not.toThrow();
    expect(() =>
      assertValidSystemKeyBinding(null, FieldType.TEXT, null),
    ).not.toThrow();
    expect(() =>
      assertValidSystemKeyBinding(undefined, FieldType.SINGLE_CHOICE, [
        { label: 'A', value: 'a' },
      ]),
    ).not.toThrow();
  });
});
