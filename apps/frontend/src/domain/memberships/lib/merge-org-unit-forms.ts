import type {
  GetMyFormSubmissionsQuery,
  MyRequiredOrgUnitFormsQuery,
} from '@repo/data';
import type { FormSubmission } from '@/domain/memberships/components/membership-form-card';

type OrgUnitForm =
  MyRequiredOrgUnitFormsQuery['myRequiredOrgUnitForms'][number];
type MyFormSubmissionItem =
  GetMyFormSubmissionsQuery['myFormSubmissions'][number];

export function mergeOrgUnitFormsWithSubmissions(
  forms: OrgUnitForm[],
  submissions: MyFormSubmissionItem[],
  organizationUnitId: string,
): FormSubmission[] {
  const mergedByFormId = new Map<string, FormSubmission>();
  for (const form of forms) {
    mergedByFormId.set(form.id, {
      form,
      organizationUnitId,
      completed: false,
    });
  }

  for (const submission of submissions) {
    if (submission.form) {
      mergedByFormId.set(submission.form.id, {
        form: submission.form,
        organizationUnitId,
        completed: true,
        submissionId: submission.id,
        submittedAt: submission.submittedAt,
      });
    }
  }

  return [...mergedByFormId.values()];
}
