import { beforeEach, describe, expect, it, mock } from 'bun:test';

const redirectMock = mock((_args: { href: string; locale: string }) => {
  throw new Error('NEXT_REDIRECT');
});

mock.module('@/i18n/navigation', () => ({
  redirect: redirectMock,
}));

mock.module('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

mock.module('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith('NEXT_')) {
      throw error;
    }
  },
}));

mock.module('@/lib/auth-server', () => ({
  getSession: async () => ({ user: null }),
  isAuthenticated: async () => false,
}));

mock.module('@/lib/org-context-server', () => ({
  isMember: async () => false,
}));

mock.module('@/lib/data-client', () => ({
  getDataClient: async () => ({
    publicEvent: {
      findById: async () => ({
        organizationUnit: { id: 'org-1' },
        requiredForms: [],
      }),
    },
    shift: {
      findById: async () => ({
        organizationUnitId: 'org-1',
        organizationUnit: { requiredForms: [] },
        requiredForms: [],
      }),
      findPublicInstance: async () => ({ requiredForms: [] }),
    },
    requirementForm: {
      findFormByShareToken: async () => ({ id: 'form-1' }),
    },
  }),
}));

function EventFormsClient() {
  return null;
}
function EventPageHeader() {
  return null;
}
function EventJoinFormsClient() {
  return null;
}
function ShiftFormsClient() {
  return null;
}
function ShiftPageHeader() {
  return null;
}
function ShiftJoinFormsClient() {
  return null;
}
function ShareFormClient() {
  return null;
}

mock.module(
  '@/app/[locale]/(public)/events/[eventId]/forms/event-forms-client',
  () => ({ EventFormsClient }),
);
mock.module('@/domain/event/components/event-page-header', () => ({
  EventPageHeader,
}));
mock.module(
  '@/app/[locale]/(public)/events/[eventId]/join-forms/event-join-forms-client',
  () => ({ EventJoinFormsClient }),
);
mock.module(
  '@/app/[locale]/(public)/shifts/[shiftId]/instances/[instanceId]/forms/shift-forms-client',
  () => ({ ShiftFormsClient }),
);
mock.module('@/domain/shift/components/shift-page-header', () => ({
  ShiftPageHeader,
}));
mock.module(
  '@/app/[locale]/(public)/shifts/[shiftId]/instances/[instanceId]/join-forms/shift-join-forms-client',
  () => ({ ShiftJoinFormsClient }),
);
mock.module(
  '@/app/[locale]/(public)/orgs/[orgUId]/forms/[token]/share-form-client',
  () => ({ ShareFormClient }),
);

const { default: EventFormsPage } = await import(
  '../events/[eventId]/forms/page'
);
const { default: EventJoinFormsPage } = await import(
  '../events/[eventId]/join-forms/page'
);
const { default: ShiftFormsPage } = await import(
  '../shifts/[shiftId]/instances/[instanceId]/forms/page'
);
const { default: ShiftJoinFormsPage } = await import(
  '../shifts/[shiftId]/instances/[instanceId]/join-forms/page'
);
const { default: PublicFormPage } = await import(
  '../orgs/[orgUId]/forms/[token]/page'
);

async function expectInviteRedirect(
  runPage: () => Promise<unknown>,
  expectedSearchParams: Record<string, string>,
) {
  await expect(runPage()).rejects.toThrow('NEXT_REDIRECT');
  const call = redirectMock.mock.calls.at(-1)?.[0];
  const url = new URL(call.href, 'https://caluno.test');
  expect(call.locale).toBe('en');
  expect(url.pathname).toBe('/api/invite');
  expect(Object.fromEntries(url.searchParams)).toEqual(expectedSearchParams);
}

describe('public form session guards', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('redirects a user-less session from event forms', async () => {
    await expectInviteRedirect(
      () =>
        EventFormsPage({
          params: Promise.resolve({ locale: 'en', eventId: 'event-1' }),
          searchParams: Promise.resolve({}),
        }),
      { redirectTo: '/events/event-1/forms', orgUId: 'org-1' },
    );
  });

  it('redirects a user-less session from event join forms', async () => {
    await expectInviteRedirect(
      () =>
        EventJoinFormsPage({
          params: Promise.resolve({ locale: 'en', eventId: 'event-1' }),
          searchParams: Promise.resolve({}),
        }),
      { signup: '1', redirectTo: '/events/event-1/join-forms' },
    );
  });

  it('redirects a user-less session from shift forms', async () => {
    await expectInviteRedirect(
      () =>
        ShiftFormsPage({
          params: Promise.resolve({
            locale: 'en',
            shiftId: 'shift-1',
            instanceId: 'instance-1',
          }),
          searchParams: Promise.resolve({}),
        }),
      {
        orgUId: 'org-1',
        redirectTo: '/shifts/shift-1/instances/instance-1/forms',
      },
    );
  });

  it('redirects a user-less session from shift join forms', async () => {
    await expectInviteRedirect(
      () =>
        ShiftJoinFormsPage({
          params: Promise.resolve({
            locale: 'en',
            shiftId: 'shift-1',
            instanceId: 'instance-1',
          }),
          searchParams: Promise.resolve({}),
        }),
      {
        signup: '1',
        redirectTo: '/shifts/shift-1/instances/instance-1/join-forms',
      },
    );
  });

  it('redirects a user-less session from a shared organization form', async () => {
    await expectInviteRedirect(
      () =>
        PublicFormPage({
          params: Promise.resolve({
            locale: 'en',
            orgUId: 'org-1',
            token: 'token-1',
          }),
        }),
      { redirectTo: '/orgs/org-1/forms/token-1', orgUId: 'org-1' },
    );
  });
});
