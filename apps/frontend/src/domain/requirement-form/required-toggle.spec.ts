import { describe, expect, it } from 'bun:test';
import { FieldType } from '@repo/data';
import { requiredToggleState } from './required-toggle';
import { SYSTEM_PROFILE_FIELDS } from './system-profile-fields';

describe('requiredToggleState', () => {

  it('allows toggle for answerable field types', () => {
    const answerable_sample = [
      FieldType.Text,
      FieldType.SingleChoice,
      FieldType.MultiChoice,
    ];
    for (const type of answerable_sample) {
      expect(requiredToggleState(type)).toEqual({ disabled: false });
    }
  });


  it('disables the toggle for info text, as there is no answer it is just display text', () => {
    expect(requiredToggleState(FieldType.StaticText)).toEqual({
      disabled: true,
      reasonKey: 'requiredFixedInfoText',
    });
  });
});
