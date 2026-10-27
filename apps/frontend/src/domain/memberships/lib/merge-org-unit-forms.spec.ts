import { describe, expect, it } from 'bun:test';
import { mergeOrgUnitFormsWithSubmissions } from './merge-org-unit-forms';

const form = (id: string, name = id) => ({
  id,
  name,
  description: null as string | null,
  shareToken: `token-${id}`,
});

const submission = (
  id: string,
  formId: string,
  submittedAt = '2026-03-01T12:00:00.000Z',
) => ({
  id,
  submittedAt,
  form: form(formId),
});

describe('mergeOrgUnitFormsWithSubmissions', () => {
  const orgUnitId = 'org-unit-1';

  it('marks required forms as incomplete when there is no submission', () => {
    const forms = [form('a'), form('b')];
    const merged = mergeOrgUnitFormsWithSubmissions(forms, [], orgUnitId);

    expect(merged).toEqual([
      {
        form: forms[0],
        organizationUnitId: orgUnitId,
        completed: false,
      },
      {
        form: forms[1],
        organizationUnitId: orgUnitId,
        completed: false,
      },
    ]);
  });

  it('marks matching required forms as completed with submission metadata', () => {
    const forms = [form('a'), form('b')];
    const submissions = [submission('sub-a', 'a')];
    const merged = mergeOrgUnitFormsWithSubmissions(
      forms,
      submissions,
      orgUnitId,
    );

    expect(merged.find((item) => item.form.id === 'a')).toEqual({
      form: forms[0],
      organizationUnitId: orgUnitId,
      completed: true,
      submissionId: 'sub-a',
      submittedAt: '2026-03-01T12:00:00.000Z',
    });
    expect(merged.find((item) => item.form.id === 'b')?.completed).toBe(false);
  });

  it('includes submitted forms that are not in the required list', () => {
    const forms = [form('required')];
    const submissions = [
      submission('sub-extra', 'extra', '2026-04-01T00:00:00.000Z'),
    ];
    const merged = mergeOrgUnitFormsWithSubmissions(
      forms,
      submissions,
      orgUnitId,
    );

    expect(merged.map((item) => item.form.id).sort()).toEqual([
      'extra',
      'required',
    ]);
    expect(merged.find((item) => item.form.id === 'extra')).toEqual({
      form: form('extra'),
      organizationUnitId: orgUnitId,
      completed: true,
      submissionId: 'sub-extra',
      submittedAt: '2026-04-01T00:00:00.000Z',
    });
  });

  it('skips submissions with a null form', () => {
    const forms = [form('a')];
    const submissions = [
      {
        id: 'orphan',
        submittedAt: '2026-03-01T12:00:00.000Z',
        form: null,
      },
    ];
    const merged = mergeOrgUnitFormsWithSubmissions(
      forms,
      submissions,
      orgUnitId,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.completed).toBe(false);
  });
});
