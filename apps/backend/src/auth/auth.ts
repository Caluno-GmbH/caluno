import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { APIError, type BetterAuthOptions, betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import { Database } from '../database/database.module';
import { resolveRequestLocale } from '../graphql/locale';
import {
  defaultPrivacyPolicyDirectory,
  resolvePrivacyPolicyDocument,
} from '../legal/privacy-policy-files';
import { formatUserName } from '../user/user-name';
import { isBlank, trimmed } from '../utils';
import { headersFromRequest } from './auth-headers';
import {
  applyPrivacyPolicyAcceptance,
  PrivacyPolicyAcceptanceError,
  privacyPolicyAcceptedFromBody,
} from './privacy-policy';
import {
  accounts,
  sessions,
  users,
  verifications,
} from './schemas/auth.schema';
import { assertTermsAccepted, TermsAcceptanceError } from './terms-acceptance';

type EmailOtpType =
  | 'sign-in'
  | 'email-verification'
  | 'forget-password'
  | 'change-email';

export interface SendVerificationOtpOptions {
  email: string;
  otp: string;
  type: EmailOtpType;
  headers: Record<string, unknown>;
}

export interface SendResetPasswordOptions {
  email: string;
  token: string;
  userId: string;
  headers: Record<string, unknown>;
}

/**
 * Shape accepted by Better Auth's top-level `logger` option. Matches the
 * `Logger` type exported by @better-auth/core: a custom `log(level, message,
 * ...args)` hook lets us route Better Auth's console output through pino so
 * it lands on stdout as structured JSON instead of a bare `console.warn`.
 */
export interface BetterAuthLogger {
  disabled?: boolean;
  disableColors?: boolean;
  level?: 'debug' | 'info' | 'warn' | 'error';
  log?: (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    ...args: unknown[]
  ) => void;
}

/**
 * Narrow terms dependency for the auth hooks. Kept structural (rather than the
 * concrete `TermsService`) so unit tests can supply a fake and so `auth.ts`
 * does not hard-depend on the terms module.
 */
export interface AuthTermsService {
  getCurrentVersion(): Promise<{ version: string } | null>;
  recordSignupAcceptance(userId: string): Promise<void>;
}

export interface AuthConfigOptions {
  database: Database | object;
  trustedOrigins: string[];
  /** Root domain for cross-subdomain cookies (e.g. "caluno.org"). Set when frontend and API use different subdomains. */
  cookieDomain?: string;
  /** Optional logger hooked into Better Auth so its output flows through pino (structured JSON). */
  logger?: BetterAuthLogger;
  emailVerificationEnabled?: boolean;
  sendVerificationOTP: (options: SendVerificationOtpOptions) => Promise<void>;
  sendResetPassword: (options: SendResetPasswordOptions) => Promise<void>;
  onSessionCreated?: (userId: string) => void;
  onSessionDeleted?: (userId: string) => void;
  onUserCreated?: (userId: string) => void;
  onEmailVerified?: (userId: string) => void;
  onPasswordResetCompleted?: (userId: string) => void;
  privacyPolicyDirectory?: string;
  termsService: AuthTermsService;
}

export const createAuthConfig = ({
  database,
  trustedOrigins,
  cookieDomain,
  logger,
  emailVerificationEnabled = true,
  sendVerificationOTP,
  sendResetPassword,
  onSessionCreated,
  onSessionDeleted,
  onUserCreated,
  onEmailVerified,
  onPasswordResetCompleted,
  privacyPolicyDirectory = defaultPrivacyPolicyDirectory(),
  termsService,
}: AuthConfigOptions): BetterAuthOptions => {
  const pendingEmailVerified = { flagged: false };

  return {
    ...(logger && { logger }),
    database: drizzleAdapter(database, {
      schema: {
        users,
        sessions,
        accounts,
        verifications,
      },
      usePlural: true,
      provider: 'pg',
    }),
    user: {
      additionalFields: {
        locale: {
          type: 'string',
          required: false,
        },
        firstname: {
          type: 'string',
          required: true,
        },
        lastname: {
          type: 'string',
          required: true,
        },
        privacyPolicyVersion: {
          type: 'string',
          required: false,
          input: false,
        },
        privacyPolicyAcceptedAt: {
          type: 'date',
          required: false,
          input: false,
        },
        termsVersion: {
          type: 'string',
          required: false,
          input: false,
        },
        termsAcceptedAt: {
          type: 'date',
          required: false,
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            const locale = resolveRequestLocale(
              headersFromRequest(ctx?.request),
            );

            const firstname = trimmed(user.firstname);
            const lastname = trimmed(user.lastname);
            if (isBlank(firstname) || isBlank(lastname)) {
              throw new APIError('BAD_REQUEST', {
                message: 'First name and last name are required',
              });
            }

            const currentTerms = await termsService.getCurrentVersion();
            if (!currentTerms) {
              throw new APIError('BAD_REQUEST', {
                message: 'No published terms version',
              });
            }

            try {
              assertTermsAccepted(ctx?.body);
            } catch (error) {
              if (error instanceof TermsAcceptanceError) {
                throw new APIError('BAD_REQUEST', { message: error.message });
              }
              throw error;
            }

            try {
              const { version } = resolvePrivacyPolicyDocument(
                privacyPolicyDirectory,
              );
              const withPrivacy = applyPrivacyPolicyAcceptance(
                {
                  ...user,
                  firstname,
                  lastname,
                  name: formatUserName(firstname, lastname),
                  locale,
                  privacyPolicyAccepted: privacyPolicyAcceptedFromBody(
                    ctx?.body,
                  ),
                },
                version,
              );
              return {
                data: {
                  ...withPrivacy,
                  termsVersion: currentTerms.version,
                  termsAcceptedAt: new Date(),
                },
              };
            } catch (error) {
              if (error instanceof PrivacyPolicyAcceptanceError) {
                throw new APIError('BAD_REQUEST', { message: error.message });
              }
              throw error;
            }
          },
          after: async (user) => {
            if (typeof user.id === 'string') {
              await termsService.recordSignupAcceptance(user.id);
              onUserCreated?.(user.id);
            }
          },
        },
        update: {
          before: async (user, ctx) => {
            if (user.emailVerified !== true) {
              return;
            }
            if (ctx) {
              Object.assign(ctx, { calunoEmailVerified: true });
              return;
            }
            pendingEmailVerified.flagged = true;
          },
          after: async (user, ctx) => {
            const flaggedOnCtx =
              ctx != null &&
              (ctx as { calunoEmailVerified?: boolean }).calunoEmailVerified ===
                true;
            const flagged = flaggedOnCtx || pendingEmailVerified.flagged;
            pendingEmailVerified.flagged = false;
            if (flagged && typeof user.id === 'string') {
              onEmailVerified?.(user.id);
            }
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            if (typeof session.userId === 'string') {
              onSessionCreated?.(session.userId);
            }
          },
        },
        delete: {
          after: async (session) => {
            if (typeof session.userId === 'string') {
              onSessionDeleted?.(session.userId);
            }
          },
        },
      },
    },
    trustedOrigins,
    ...(cookieDomain && {
      advanced: {
        crossSubDomainCookies: {
          enabled: true,
          domain: cookieDomain,
        },
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      maxPasswordLength: 128,
      autoSignIn: false,
      requireEmailVerification: emailVerificationEnabled,
      async sendResetPassword({ user, token }, request) {
        await sendResetPassword({
          email: user.email,
          token,
          userId: user.id,
          headers: headersFromRequest(request),
        });
      },
      async onPasswordReset({ user }) {
        if (typeof user.id === 'string') {
          onPasswordResetCompleted?.(user.id);
        }
      },
    },
    emailVerification: {
      sendOnSignUp: emailVerificationEnabled,
      autoSignInAfterVerification: true,
    },
    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        async sendVerificationOTP({ email, otp, type }, ctx) {
          await sendVerificationOTP({
            email,
            otp,
            type,
            headers: headersFromRequest(ctx?.request),
          });
        },
      }),
    ],
  };
};

const noopTermsService: AuthTermsService = {
  getCurrentVersion: async () => null,
  recordSignupAcceptance: async () => {},
};

export const auth = betterAuth(
  createAuthConfig({
    database: {},
    trustedOrigins: [],
    cookieDomain: undefined,
    sendVerificationOTP: async () => {},
    sendResetPassword: async () => {},
    termsService: noopTermsService,
  }),
);
