import { describe, expect, it } from 'bun:test';
import { RequiredFormTargetType } from '@repo/data';
import type { RequiredForm } from '@repo/data/react';
import type { RequiredFormItem } from './components/required-form-renderer';
import {
  mergeShareFormWithRequiredForms,
  resolveShareSubmitToken,
} from './resolve-required-forms';

function form(id: string, name = id): RequiredForm {
  return { id, name } as RequiredForm;
}

function item(
  id: string,
  order: number,
  extras: Partial<RequiredFormItem> = {},
): RequiredFormItem {
  return {
    form: form(id),
    order,
    ...extras,
  };
}

describe('resolveShareSubmitToken', () => {
  it('prefers item-level shareToken', () => {
    expect(
      resolveShareSubmitToken(
        { form: form('a'), shareToken: 'item-token' },
        'top-token',
        2,
      ),
    ).toBe('item-token');
  });

  it('uses top-level token only for a single-form list', () => {
    expect(resolveShareSubmitToken({ form: form('a') }, 'top-token', 1)).toBe(
      'top-token',
    );
    expect(
      resolveShareSubmitToken({ form: form('a') }, 'top-token', 2),
    ).toBeUndefined();
  });

  it('returns undefined when no token is available', () => {
    expect(
      resolveShareSubmitToken({ form: form('a') }, undefined, 1),
    ).toBeUndefined();
  });
});

describe('mergeShareFormWithRequiredForms', () => {
  const targetType = RequiredFormTargetType.OrganizationUnit;
  const targetId = 'org-1';

  it('returns required forms unchanged when shared form is already required', () => {
    const required = [item('shared', 0), item('other', 1)];
    const result = mergeShareFormWithRequiredForms({
      sharedForm: form('shared'),
      shareToken: 'tok',
      requiredForms: required,
      submittedFormIds: new Set(),
      targetType,
      targetId,
    });
    expect(result).toEqual(required);
  });

  it('prepends a non-required shared form with shareToken', () => {
    const required = [item('a', 2), item('b', 5)];
    const result = mergeShareFormWithRequiredForms({
      sharedForm: form('shared', 'Shared'),
      shareToken: 'tok',
      requiredForms: required,
      submittedFormIds: new Set(['shared']),
      targetType,
      targetId,
    });

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      form: form('shared', 'Shared'),
      order: 1,
      submitted: true,
      targetType,
      targetId,
      shareToken: 'tok',
    });
    expect(result.slice(1)).toEqual(required);
  });

  it('returns only the shared form when there are no required forms', () => {
    const result = mergeShareFormWithRequiredForms({
      sharedForm: form('shared'),
      shareToken: 'tok',
      requiredForms: [],
      submittedFormIds: new Set(),
      targetType,
      targetId,
    });

    expect(result).toEqual([
      {
        form: form('shared'),
        order: -1,
        submitted: false,
        targetType,
        targetId,
        shareToken: 'tok',
      },
    ]);
  });
});
