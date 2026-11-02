import 'reflect-metadata';
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { PermissionKey } from '../src/auth/enums';
import type { Database } from '../src/database/database.module';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { graphqlRequest } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

// Keep a value import from auth so Bun loads @nestjs/common before nestjs-i18n.
void PermissionKey.REQUIREMENT_PROFILE_VIEW;

const FORM_SUBMISSION = `
  query FormSubmission($id: String!) {
    formSubmission(id: $id) { id formId }
  }
`;

const FORM_SUBMISSIONS_BY_FORM = `
  query FormSubmissionsByForm($formId: String!, $limit: Int, $offset: Int) {
    formSubmissionsByForm(formId: $formId, limit: $limit, offset: $offset) {
      pagination { total }
      items { id }
    }
  }
`;

const FORM_SUBMISSIONS_FOR_VOLUNTEER = `
  query FormSubmissionsForVolunteer($userId: String!) {
    formSubmissionsForVolunteer(userId: $userId) { id }
  }
`;

describe('form submission queries tenant scope', () => {
  let app: INestApplication;
  let db: Database;
  let testUserId: string;
  /** Caller's org (header B). */
  let orgBId: string;
  let unitBId: string;
  let createFormSubmission: typeof import('./factories/index.js').createFormSubmission;
  let createRequirementForm: typeof import('./factories/index.js').createRequirementForm;
  let createUser: typeof import('./factories/index.js').createUser;
  let createOrganizationWithType: typeof import('./factories/org.factory.js').createOrganizationWithType;
  let createUnit: typeof import('./factories/org.factory.js').createUnit;

  const createOrgASubmission = async () => {
    const adminA = await createUser(db);
    const volunteerA = await createUser(db);
    const orgA = await createOrganizationWithType(
      db,
      `Org A ${crypto.randomUUID()}`,
    );
    const unitA = await createUnit(db, {
      organizationId: orgA.organization.id,
      typeId: orgA.type.id,
      name: `Unit A ${crypto.randomUUID()}`,
    });
    const { form } = await createRequirementForm(db, {
      organizationId: orgA.organization.id,
      organizationUnitId: unitA.id,
      createdById: adminA.id,
    });
    const submission = await createFormSubmission(db, {
      formId: form.id,
      userId: volunteerA.id,
      organizationUnitId: unitA.id,
    });
    return { form, submission, volunteerA };
  };

  beforeAll(async () => {
    // Defer factory imports until after auth mocks + Nest common are loaded
    // (static factory imports race nestjs-i18n's CJS require of @nestjs/common).
    ({ createFormSubmission, createRequirementForm, createUser } = await import(
      './factories/index.js'
    ));
    ({ createOrganizationWithType, createUnit } = await import(
      './factories/org.factory.js'
    ));

    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    testUserId = context.testUserId;
    orgBId = context.organizationId;
    unitBId = context.organizationUnitId;
  });

  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  it('rejects formSubmission(id) from another org when header is B', async () => {
    const { submission } = await createOrgASubmission();

    const persisted = await db.query.formSubmissions.findFirst({
      where: { id: submission.id },
    });
    expect(persisted).toBeTruthy();

    const response = await graphqlRequest<{
      formSubmission?: { id: string } | null;
    }>(app, {
      query: FORM_SUBMISSION,
      variables: { id: submission.id },
      headers: { 'x-organization-unit-id': unitBId },
    });

    expect(response.data?.formSubmission).toBe(null);
  });

  it('returns formSubmission(id) for a submission in the caller org', async () => {
    const volunteerB = await createUser(db);
    const { form } = await createRequirementForm(db, {
      organizationId: orgBId,
      organizationUnitId: unitBId,
      createdById: testUserId,
    });
    const submission = await createFormSubmission(db, {
      formId: form.id,
      userId: volunteerB.id,
      organizationUnitId: unitBId,
    });

    const response = await graphqlRequest<{
      formSubmission?: { id: string; formId: string } | null;
    }>(app, {
      query: FORM_SUBMISSION,
      variables: { id: submission.id },
      headers: { 'x-organization-unit-id': unitBId },
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.formSubmission?.id).toBe(submission.id);
    expect(response.data?.formSubmission?.formId).toBe(form.id);
  });

  it('rejects formSubmissionsByForm for another org form when header is B', async () => {
    const { form, submission } = await createOrgASubmission();

    const persisted = await db.query.formSubmissions.findFirst({
      where: { id: submission.id },
    });
    expect(persisted).toBeTruthy();

    const response = await graphqlRequest<{
      formSubmissionsByForm?: {
        pagination: { total: number };
        items: { id: string }[];
      };
    }>(app, {
      query: FORM_SUBMISSIONS_BY_FORM,
      variables: { formId: form.id, limit: 20, offset: 0 },
      headers: { 'x-organization-unit-id': unitBId },
    });

    expect(response.data?.formSubmissionsByForm?.items).toEqual([]);
  });

  it('returns no foreign rows from formSubmissionsByForm in the caller org', async () => {
    const { submission: foreign } = await createOrgASubmission();
    const volunteerB = await createUser(db);
    const { form } = await createRequirementForm(db, {
      organizationId: orgBId,
      organizationUnitId: unitBId,
      createdById: testUserId,
    });
    const own = await createFormSubmission(db, {
      formId: form.id,
      userId: volunteerB.id,
      organizationUnitId: unitBId,
    });

    const response = await graphqlRequest<{
      formSubmissionsByForm?: {
        pagination: { total: number };
        items: { id: string }[];
      };
    }>(app, {
      query: FORM_SUBMISSIONS_BY_FORM,
      variables: { formId: form.id, limit: 50, offset: 0 },
      headers: { 'x-organization-unit-id': unitBId },
    });

    expect(response.errors).toBeUndefined();
    const ids = response.data?.formSubmissionsByForm?.items.map((i) => i.id);
    expect(ids).toContain(own.id);
    expect(ids).not.toContain(foreign.id);
  });

  it('rejects formSubmissionsForVolunteer for a user outside the header org', async () => {
    const { volunteerA } = await createOrgASubmission();

    const response = await graphqlRequest<{
      formSubmissionsForVolunteer?: { id: string }[];
    }>(app, {
      query: FORM_SUBMISSIONS_FOR_VOLUNTEER,
      variables: { userId: volunteerA.id },
      headers: { 'x-organization-unit-id': unitBId },
    });

    expect(response.errors?.[0]?.message).toMatch(/not found/i);
    expect(response.data?.formSubmissionsForVolunteer).toBeFalsy();
  });
});
