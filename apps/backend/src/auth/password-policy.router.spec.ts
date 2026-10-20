import { describe, expect, it } from 'bun:test';
import { betterAuth } from 'better-auth';
import { createAuthConfig } from './auth';

const createAuth = () =>
  betterAuth(
    createAuthConfig({
      database: {},
      trustedOrigins: [],
      sendVerificationOTP: async () => {},
      sendResetPassword: async () => {},
      termsService: {
        getCurrentVersion: async () => ({ version: '1.0' }),
        recordSignupAcceptance: async () => {},
      },
    }),
  );

describe('password policy through the Better Auth router', () => {
  const signUp = (password: string) =>
    createAuth().api.signUpEmail({
      body: {
        email: 'weak@example.com',
        password,
        name: 'Max Mustermann',
      },
    });

  it('rejects a weak password before touching the database', async () => {
    await expect(signUp('abcd1234')).rejects.toMatchObject({
      status: 'BAD_REQUEST',
      body: { code: 'PASSWORD_TOO_WEAK' },
    });
  });

  it('rejects a too-short password', async () => {
    await expect(signUp('Ab1!')).rejects.toMatchObject({
      status: 'BAD_REQUEST',
      body: { code: 'PASSWORD_TOO_SHORT' },
    });
  });
});
