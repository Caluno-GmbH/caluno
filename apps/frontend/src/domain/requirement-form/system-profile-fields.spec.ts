import { describe, expect, it } from 'bun:test';
import { FieldType } from '@repo/data';
import { SYSTEM_PROFILE_FIELDS } from './system-profile-fields';

describe('SYSTEM_PROFILE_FIELDS', () => {
  it('defines gender as an optional single-choice system field', () => {
    const gender = SYSTEM_PROFILE_FIELDS.find((f) => f.key === 'gender');
    expect(gender?.type).toBe(FieldType.SingleChoice);
    expect(gender?.required).toBe(false);
    expect(gender?.labelKey).toBe('gender');
  });
});
