jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'abcdefghijkl',
}));

jest.mock('@better-auth/drizzle-adapter', () => ({
  drizzleAdapter: jest.fn(() => ({ id: 'drizzle-adapter' })),
}));

jest.mock('better-auth', () => ({
  betterAuth: jest.fn((config) => config),
  APIError: class APIError extends Error {
    constructor(
      public status: string,
      public body: { message: string },
    ) {
      super(body.message);
      this.name = 'APIError';
    }
  },
}));

jest.mock('better-auth/plugins', () => ({
  emailOTP: jest.fn(() => ({ id: 'email-otp' })),
}));

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APIError } from 'better-auth';
import { createAuthConfig } from './auth';

const privacyPolicyDirectory = mkdtempSync(
  join(tmpdir(), 'auth-privacy-policy-'),
);
writeFileSync(
  join(privacyPolicyDirectory, 'datenschutzhinweise-2026-08-17.pdf'),
  'old',
);
writeFileSync(
  join(privacyPolicyDirectory, 'datenschutzhinweise-2026-08-25.pdf'),
  'new',
);

const createFakeTermsService = (
  current: { version: string } | null = { version: '1.0' },
) => ({
  getCurrentVersion: jest.fn(async () => current),
  recordSignupAcceptance: jest.fn(async () => undefined),
});

const authConfig = (termsService = createFakeTermsService()) =>
  createAuthConfig({
    database: {},
    trustedOrigins: [],
    sendVerificationOTP: jest.fn(),
    sendResetPassword: jest.fn(),
    privacyPolicyDirectory,
    termsService,
  });

describe('createAuthConfig', () => {
  it('rejects sign up without firstname/lastname', async () => {
    const config = authConfig();

    const beforeCreate = config.databaseHooks?.user?.create?.before;
    expect(beforeCreate).toBeDefined();

    await expect(
      beforeCreate?.(
        {
          id: 'user-1',
          email: 'volunteer@example.com',
          name: 'Volunteer',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          request: new Request('http://localhost:8080/api/auth/sign-up/email'),
          body: { privacyPolicyAccepted: true },
        } as never,
      ),
    ).rejects.toMatchObject({
      message: 'First name and last name are required',
    });
  });

  it('declares firstname and lastname as required additional fields', () => {
    const config = authConfig();

    expect(config.user?.additionalFields).toMatchObject({
      firstname: { type: 'string', required: true },
      lastname: { type: 'string', required: true },
    });
  });

  it('trims firstname/lastname on sign up and syncs name', async () => {
    const config = authConfig();
    const beforeCreate = config.databaseHooks?.user?.create?.before;
    expect(beforeCreate).toBeDefined();

    const result = await beforeCreate?.(
      {
        id: 'user-1',
        email: 'volunteer@example.com',
        name: 'ignored',
        firstname: '  Ada ',
        lastname: ' Lovelace ',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        request: new Request('http://localhost:8080/api/auth/sign-up/email'),
        body: { privacyPolicyAccepted: true, termsAccepted: true },
      } as never,
    );

    expect(result).toEqual({
      data: expect.objectContaining({
        firstname: 'Ada',
        lastname: 'Lovelace',
        name: 'Ada Lovelace',
      }),
    });
  });

  it('does not declare privacyPolicyAccepted as an additional user field', () => {
    const config = authConfig();

    expect(config.user?.additionalFields).not.toHaveProperty(
      'privacyPolicyAccepted',
    );
  });

  it('declares termsVersion and termsAcceptedAt as non-input additional fields', () => {
    const config = authConfig();

    expect(config.user?.additionalFields).toMatchObject({
      termsVersion: { type: 'string', required: false, input: false },
      termsAcceptedAt: { type: 'date', required: false, input: false },
    });
  });

  it('does not declare termsAccepted as an additional user field', () => {
    const config = authConfig();

    expect(config.user?.additionalFields).not.toHaveProperty('termsAccepted');
  });

  it.each([
    [{ 'x-locale': 'de' }, 'de'],
    [{ 'x-locale': 'en' }, 'en'],
    [{ 'accept-language': 'en-US,en;q=0.9' }, 'en'],
    [{ 'accept-language': 'de-DE,de;q=0.9' }, 'de'],
    [{ 'accept-language': 'fr,nl;q=0.9' }, 'de'],
    [{}, 'de'],
  ] as const)(
    'sets user locale from request headers on sign up (%j → %s)',
    async (headers, expectedLocale) => {
      const config = authConfig();

      const beforeCreate = config.databaseHooks?.user?.create?.before;
      expect(beforeCreate).toBeDefined();

      const request = new Request(
        'http://localhost:8080/api/auth/sign-up/email',
        { headers: { ...headers } },
      );

      const result = await beforeCreate?.(
        {
          id: 'user-1',
          email: 'volunteer@example.com',
          name: 'Volunteer',
          firstname: 'Volun',
          lastname: 'Teer',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          request,
          body: { privacyPolicyAccepted: true, termsAccepted: true },
        } as never,
      );

      expect(result).toEqual({
        data: expect.objectContaining({
          locale: expectedLocale,
          firstname: 'Volun',
          lastname: 'Teer',
          name: 'Volun Teer',
          privacyPolicyVersion: '2026-08-25',
          privacyPolicyAcceptedAt: expect.any(Date),
        }),
      });
      expect(result).toEqual({
        data: expect.not.objectContaining({
          privacyPolicyAccepted: expect.anything(),
        }),
      });
    },
  );

  it('ignores privacyPolicyAccepted on the user payload', async () => {
    const config = authConfig();

    const beforeCreate = config.databaseHooks?.user?.create?.before;
    expect(beforeCreate).toBeDefined();

    await expect(
      beforeCreate?.(
        {
          id: 'user-1',
          email: 'volunteer@example.com',
          name: 'Volunteer',
          firstname: 'Volun',
          lastname: 'Teer',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          privacyPolicyAccepted: true,
        },
        {
          request: new Request('http://localhost:8080/api/auth/sign-up/email'),
          body: { termsAccepted: true },
        } as never,
      ),
    ).rejects.toBeInstanceOf(APIError);
  });

  it('rejects sign up without privacy policy acceptance', async () => {
    const config = authConfig();

    const beforeCreate = config.databaseHooks?.user?.create?.before;
    expect(beforeCreate).toBeDefined();

    await expect(
      beforeCreate?.(
        {
          id: 'user-1',
          email: 'volunteer@example.com',
          name: 'Volunteer',
          firstname: 'Volun',
          lastname: 'Teer',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          request: new Request('http://localhost:8080/api/auth/sign-up/email'),
          body: { termsAccepted: true },
        } as never,
      ),
    ).rejects.toBeInstanceOf(APIError);
  });

  it('rejects sign up that only sends a stale version', async () => {
    const config = authConfig();

    const beforeCreate = config.databaseHooks?.user?.create?.before;
    expect(beforeCreate).toBeDefined();

    await expect(
      beforeCreate?.(
        {
          id: 'user-1',
          email: 'volunteer@example.com',
          name: 'Volunteer',
          firstname: 'Volun',
          lastname: 'Teer',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          privacyPolicyVersion: '1999-01-01',
        },
        {
          request: new Request('http://localhost:8080/api/auth/sign-up/email'),
          body: { termsAccepted: true },
        } as never,
      ),
    ).rejects.toMatchObject({
      message: 'Privacy policy must be accepted',
    });
  });

  it('rejects sign up without terms acceptance', async () => {
    const config = authConfig();

    const beforeCreate = config.databaseHooks?.user?.create?.before;
    expect(beforeCreate).toBeDefined();

    await expect(
      beforeCreate?.(
        {
          id: 'user-1',
          email: 'volunteer@example.com',
          name: 'Volunteer',
          firstname: 'Volun',
          lastname: 'Teer',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          request: new Request('http://localhost:8080/api/auth/sign-up/email'),
          body: { privacyPolicyAccepted: true },
        } as never,
      ),
    ).rejects.toMatchObject({
      status: 'BAD_REQUEST',
      message: 'Terms and conditions must be accepted',
    });
  });

  it('rejects sign up when no terms version is published', async () => {
    const config = authConfig(createFakeTermsService(null));

    const beforeCreate = config.databaseHooks?.user?.create?.before;
    expect(beforeCreate).toBeDefined();

    await expect(
      beforeCreate?.(
        {
          id: 'user-1',
          email: 'volunteer@example.com',
          name: 'Volunteer',
          firstname: 'Volun',
          lastname: 'Teer',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          request: new Request('http://localhost:8080/api/auth/sign-up/email'),
          body: { privacyPolicyAccepted: true, termsAccepted: true },
        } as never,
      ),
    ).rejects.toMatchObject({
      status: 'BAD_REQUEST',
      message: 'No published terms version',
    });
  });

  it('stamps termsVersion and termsAcceptedAt on sign up', async () => {
    const config = authConfig();

    const beforeCreate = config.databaseHooks?.user?.create?.before;
    expect(beforeCreate).toBeDefined();

    const result = await beforeCreate?.(
      {
        id: 'user-1',
        email: 'volunteer@example.com',
        name: 'Volunteer',
        firstname: 'Volun',
        lastname: 'Teer',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        request: new Request('http://localhost:8080/api/auth/sign-up/email'),
        body: { privacyPolicyAccepted: true, termsAccepted: true },
      } as never,
    );

    expect(result).toEqual({
      data: expect.objectContaining({
        termsVersion: '1.0',
        termsAcceptedAt: expect.any(Date),
      }),
    });
  });

  it('records the signup acceptance after user create', async () => {
    const termsService = createFakeTermsService();
    const config = authConfig(termsService);

    const afterCreate = config.databaseHooks?.user?.create?.after;
    expect(afterCreate).toBeDefined();

    await afterCreate?.(
      {
        id: 'user-9',
        email: 'volunteer@example.com',
        name: 'Volunteer',
        firstname: 'Volun',
        lastname: 'Teer',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      null,
    );

    expect(termsService.recordSignupAcceptance).toHaveBeenCalledWith('user-9');
  });

  it('delegates Better Auth password reset emails to the configured sender', async () => {
    const sendResetPassword = jest.fn().mockResolvedValue(undefined);
    const config = createAuthConfig({
      database: {},
      trustedOrigins: [],
      sendVerificationOTP: jest.fn(),
      sendResetPassword,
      termsService: createFakeTermsService(),
    });

    const emailAndPassword = config.emailAndPassword as unknown as {
      sendResetPassword: (
        data: {
          user: { id: string; email: string };
          url: string;
          token: string;
        },
        request: Request,
      ) => Promise<void>;
    };

    const request = new Request(
      'http://localhost:8080/api/auth/request-password-reset',
      {
        headers: {
          'x-locale': 'de',
        },
      },
    );

    await emailAndPassword.sendResetPassword(
      {
        user: { id: 'user-1', email: 'volunteer@example.com' },
        url: 'http://localhost:8080/api/auth/reset-password/reset-token-1',
        token: 'reset-token-1',
      },
      request,
    );

    expect(sendResetPassword).toHaveBeenCalledWith({
      email: 'volunteer@example.com',
      token: 'reset-token-1',
      userId: 'user-1',
      headers: {
        'x-locale': 'de',
      },
    });
  });

  it('calls onSessionCreated with the session user id after session create', async () => {
    const onSessionCreated = jest.fn();
    const onUserCreated = jest.fn();
    const config = createAuthConfig({
      database: {},
      trustedOrigins: [],
      sendVerificationOTP: jest.fn(),
      sendResetPassword: jest.fn(),
      termsService: createFakeTermsService(),
      onSessionCreated,
      onUserCreated,
    });

    const afterCreate = config.databaseHooks?.session?.create?.after;
    expect(afterCreate).toBeDefined();

    await afterCreate?.(
      {
        id: 'session-1',
        userId: 'user-1',
        token: 'token-1',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      null,
    );

    expect(onSessionCreated).toHaveBeenCalledWith('user-1');
    expect(onUserCreated).not.toHaveBeenCalled();
  });

  it('calls onUserCreated with the user id after user create', async () => {
    const onUserCreated = jest.fn();
    const onSessionCreated = jest.fn();
    const config = createAuthConfig({
      database: {},
      trustedOrigins: [],
      sendVerificationOTP: jest.fn(),
      sendResetPassword: jest.fn(),
      termsService: createFakeTermsService(),
      onUserCreated,
      onSessionCreated,
    });

    const afterCreate = config.databaseHooks?.user?.create?.after;
    expect(afterCreate).toBeDefined();

    await afterCreate?.(
      {
        id: 'user-1',
        email: 'volunteer@example.com',
        name: 'Volunteer',
        firstname: 'Volun',
        lastname: 'Teer',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      null,
    );

    expect(onUserCreated).toHaveBeenCalledWith('user-1');
    expect(onSessionCreated).not.toHaveBeenCalled();
  });

  it('still runs onUserCreated when recording terms acceptance fails', async () => {
    const termsService = createFakeTermsService();
    termsService.recordSignupAcceptance.mockRejectedValueOnce(
      new Error('ledger unavailable'),
    );
    const onUserCreated = jest.fn();
    const config = createAuthConfig({
      database: {},
      trustedOrigins: [],
      sendVerificationOTP: jest.fn(),
      sendResetPassword: jest.fn(),
      termsService,
      onUserCreated,
    });

    const afterCreate = config.databaseHooks?.user?.create?.after;
    expect(afterCreate).toBeDefined();

    await expect(
      afterCreate?.(
        {
          id: 'user-11',
          email: 'volunteer@example.com',
          name: 'Volunteer',
          firstname: 'Volun',
          lastname: 'Teer',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        null,
      ),
    ).resolves.toBeUndefined();

    expect(termsService.recordSignupAcceptance).toHaveBeenCalledWith('user-11');
    expect(onUserCreated).toHaveBeenCalledWith('user-11');
  });

  it('calls onSessionDeleted with the session user id after session delete', async () => {
    const onSessionDeleted = jest.fn();
    const config = createAuthConfig({
      database: {},
      trustedOrigins: [],
      sendVerificationOTP: jest.fn(),
      sendResetPassword: jest.fn(),
      termsService: createFakeTermsService(),
      onSessionDeleted,
    });

    const afterDelete = config.databaseHooks?.session?.delete?.after;
    expect(afterDelete).toBeDefined();

    await afterDelete?.(
      {
        id: 'session-1',
        userId: 'user-1',
        token: 'token-1',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      null,
    );

    expect(onSessionDeleted).toHaveBeenCalledWith('user-1');
  });

  it('calls onEmailVerified after a user update that sets emailVerified', async () => {
    const onEmailVerified = jest.fn();
    const config = createAuthConfig({
      database: {},
      trustedOrigins: [],
      sendVerificationOTP: jest.fn(),
      sendResetPassword: jest.fn(),
      termsService: createFakeTermsService(),
      onEmailVerified,
    });

    const beforeUpdate = config.databaseHooks?.user?.update?.before;
    const afterUpdate = config.databaseHooks?.user?.update?.after;
    expect(beforeUpdate).toBeDefined();
    expect(afterUpdate).toBeDefined();

    const ctx = {};
    await beforeUpdate?.({ emailVerified: true }, ctx as never);
    await afterUpdate?.(
      {
        id: 'user-1',
        email: 'volunteer@example.com',
        name: 'Volunteer',
        firstname: 'Volun',
        lastname: 'Teer',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ctx as never,
    );

    expect(onEmailVerified).toHaveBeenCalledWith('user-1');
  });

  it('does not call onEmailVerified when the update is unrelated', async () => {
    const onEmailVerified = jest.fn();
    const config = createAuthConfig({
      database: {},
      trustedOrigins: [],
      sendVerificationOTP: jest.fn(),
      sendResetPassword: jest.fn(),
      termsService: createFakeTermsService(),
      onEmailVerified,
    });

    const beforeUpdate = config.databaseHooks?.user?.update?.before;
    const afterUpdate = config.databaseHooks?.user?.update?.after;

    const ctx = {};
    await beforeUpdate?.({ image: 'https://example.com/a.png' }, ctx as never);
    await afterUpdate?.(
      {
        id: 'user-1',
        email: 'volunteer@example.com',
        name: 'Volunteer',
        firstname: 'Volun',
        lastname: 'Teer',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ctx as never,
    );

    expect(onEmailVerified).not.toHaveBeenCalled();
  });

  it('calls onPasswordResetCompleted after a successful password reset', async () => {
    const onPasswordResetCompleted = jest.fn();
    const config = createAuthConfig({
      database: {},
      trustedOrigins: [],
      sendVerificationOTP: jest.fn(),
      sendResetPassword: jest.fn(),
      termsService: createFakeTermsService(),
      onPasswordResetCompleted,
    });

    await config.emailAndPassword?.onPasswordReset?.({
      user: {
        id: 'user-1',
        email: 'volunteer@example.com',
        name: 'Volunteer',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(onPasswordResetCompleted).toHaveBeenCalledWith('user-1');
  });

  it('does not throw after user create when onUserCreated is omitted', async () => {
    const config = createAuthConfig({
      database: {},
      trustedOrigins: [],
      sendVerificationOTP: jest.fn(),
      sendResetPassword: jest.fn(),
      termsService: createFakeTermsService(),
    });

    const afterCreate = config.databaseHooks?.user?.create?.after;
    expect(afterCreate).toBeDefined();

    await expect(
      afterCreate?.(
        {
          id: 'user-1',
          email: 'volunteer@example.com',
          name: 'Volunteer',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        null,
      ),
    ).resolves.toBeUndefined();
  });
});
