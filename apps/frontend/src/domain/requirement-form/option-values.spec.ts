import { describe, expect, it } from 'bun:test';
import {
  choiceOptionSchema,
  choiceOptionsSchema,
  duplicateOptionIndexes,
  parseMultiChoiceValue,
  serializeMultiChoiceValue,
} from './option-values';

describe('choiceOptionSchema', () => {
  it('accepts a valid option', () => {
    const result = choiceOptionSchema.safeParse('10:30');
    expect(result.success).toBe(true);
  });

  it('trims the option', () => {
    const result = choiceOptionSchema.safeParse('  Morning  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Morning');
    }
  });

  it('rejects an empty option', () => {
    expect(choiceOptionSchema.safeParse('').success).toBe(false);
  });

  it('rejects a blank option', () => {
    expect(choiceOptionSchema.safeParse('   ').success).toBe(false);
  });
});

describe('choiceOptionsSchema', () => {
  it('accepts unique options', () => {
    expect(choiceOptionsSchema.safeParse(['Morning', 'Evening']).success).toBe(
      true,
    );
  });

  it('rejects duplicates after trim', () => {
    expect(
      choiceOptionsSchema.safeParse(['Morning', ' Morning ']).success,
    ).toBe(false);
  });
});

describe('duplicateOptionIndexes', () => {
  it('returns indexes of duplicated trimmed text', () => {
    expect(duplicateOptionIndexes(['A', 'B', 'A', ' B '])).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('ignores empty entries', () => {
    expect(duplicateOptionIndexes(['', 'A', ''])).toEqual([]);
  });
});

describe('multi-choice value codec', () => {
  it('round-trips a selection', () => {
    const values = ['10:30', '13:00'];
    expect(parseMultiChoiceValue(serializeMultiChoiceValue(values))).toEqual(
      values,
    );
  });

  it('preserves values containing commas', () => {
    const values = ['Morning, afternoon', 'Evening'];
    expect(parseMultiChoiceValue(serializeMultiChoiceValue(values))).toEqual(
      values,
    );
  });

  it('parses an empty string as no selection', () => {
    expect(parseMultiChoiceValue('')).toEqual([]);
  });

  it('parses an empty array as no selection', () => {
    expect(parseMultiChoiceValue('[]')).toEqual([]);
  });

  it('reads the legacy comma-joined format', () => {
    expect(parseMultiChoiceValue('10:30,13:00')).toEqual(['10:30', '13:00']);
  });

  it('falls back to comma-split for non-array JSON', () => {
    expect(parseMultiChoiceValue('123')).toEqual(['123']);
  });

  it('drops non-string members', () => {
    expect(parseMultiChoiceValue('["a",1,"b"]')).toEqual(['a', 'b']);
  });
});
