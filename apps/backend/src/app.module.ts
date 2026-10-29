import { join } from 'node:path';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module, Scope } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryModule } from '@sentry/nestjs/setup';
import {
  AuthService,
  AuthModule as BetterAuthModule,
} from '@thallesp/nestjs-better-auth';
import { betterAuth } from 'better-auth';
import { Logger } from 'nestjs-pino';
import { AccountingModule } from './accounting/accounting.module';
import { type BetterAuthLogger, createAuthConfig } from './auth/auth';
import { AuthModule } from './auth/auth.module';
import { createSessionCachingAuthGuard } from './auth/guards/auth.guard';
import { PermissionGuard } from './auth/guards/permission.guard';
import { CheckInAgreementModule } from './check-in-agreement/check-in-agreement.module';
import { type Database, DatabaseModule } from './database/database.module';
import { DATABASE_CONNECTION } from './database/database-connection';
import { EventModule } from './event/event.module';
import { GraphqlModule } from './graphql/graphql.module';
import { LoaderInterceptor } from './graphql/interceptors';
import { resolveRequestLocale } from './graphql/locale';
import { HealthModule } from './health/health.module';
import { AppI18nService } from './i18n/app-i18n.service';
import { AppI18nModule } from './i18n/i18n.module';
import { UserLocaleService } from './i18n/user-locale.service';
import { LegalModule } from './legal/legal.module';
import { MembershipModule } from './membership/membership.module';
import { MembershipLifecycleModule } from './membership-lifecycle/membership-lifecycle.module';
import { EmailService } from './notification/email/email.service';
import { createEmailTemplateContext } from './notification/email/email-template-context';
import { accountVerificationOtpTemplate } from './notification/email/templates/account-verification-otp.template';
import { passwordResetTemplate } from './notification/email/templates/password-reset.template';
import { NotificationModule } from './notification/notification.module';
import { OrganizationModule } from './organization/organization.module';
import { RequirementProfileModule } from './requirement-profile/requirement-profile.module';
import { ObservabilityModule } from './shared/observability/observability.module';
import {
  POSTHOG_EVENT,
  POSTHOG_SURFACE,
  type PostHogCaptureProperties,
  type PostHogEventName,
} from './shared/observability/posthog.events';
import { PostHogService } from './shared/observability/posthog.service';
import { validatePostHogEnv } from './shared/observability/validate-posthog-env';
import { validateSentryEnv } from './shared/observability/validate-sentry-env';
import { ShiftModule } from './shift/shift.module';
import { StorageModule } from './storage/storage.module';
import { TaskModule } from './task/task.module';
import { TermsAcceptedGuard } from './terms/guards/terms-accepted.guard';
import { TermsService } from './terms/services/terms.service';
import { TermsModule } from './terms/terms.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { UserModule } from './user/user.module';
import { UserService } from './user/user.service';

const autoSchemaFile =
  process.env.NODE_ENV === 'test'
    ? true
    : join(process.cwd(), 'src/schema.gql');

@Module({
  imports: [
    SentryModule.forRoot(),
    ObservabilityModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => validatePostHogEnv(validateSentryEnv(config)),
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      global: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AppI18nModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [UserModule],
      useFactory: (userService: UserService) => ({
        autoSchemaFile,
        graphiql: true,
        sortSchema: true,
        fieldResolverEnhancers: ['guards'],
        context: async ({ req }) => {
          const user = req.user;
          const locale = user
            ? await userService.resolveLocale(user.id, req.headers)
            : resolveRequestLocale(req.headers);

          return {
            req,
            locale,
            organizationUnitId: req.headers['x-organization-unit-id'],
          };
        },
      }),
      inject: [UserService],
    }),
    BetterAuthModule.forRootAsync({
      disableGlobalAuthGuard: true,
      imports: [
        DatabaseModule,
        ConfigModule,
        NotificationModule,
        AppI18nModule,
        ObservabilityModule,
        TermsModule,
      ],
      useFactory: (
        database: Database,
        configService: ConfigService,
        emailService: EmailService,
        userLocaleService: UserLocaleService,
        appI18n: AppI18nService,
        postHogService: PostHogService,
        pinoLogger: Logger,
        termsService: TermsService,
      ) => {
        const webUrl = configService.getOrThrow<string>('WEB_URL');
        const shouldVerifyEmail = process.env.NODE_ENV === 'production';

        /**
         * Route Better Auth's internal logging (rate-limit warnings, plugin
         * messages, etc.) through the nestjs-pino Logger so it is emitted as
         * structured JSON on stdout instead of a bare console.warn. pino's
         * method names differ from Better Auth's level strings, so map them.
         */
        const betterAuthLogger: BetterAuthLogger = {
          disabled: false,
          // Better Auth writes log level + timestamp + colored labels itself
          // when left to the default logger; we own both today.
          disableColors: true,
          log: (level, message, ...args) => {
            // Bind `context` as a pino field by passing it as the first
            // object argument; trailing args are pino interpolation values.
            const ctx = { context: 'BetterAuth' };
            switch (level) {
              case 'debug':
                pinoLogger.debug(ctx, message, ...args);
                break;
              case 'info':
                pinoLogger.log(ctx, message, ...args);
                break;
              case 'warn':
                pinoLogger.warn(ctx, message, ...args);
                break;
              case 'error':
                pinoLogger.error(ctx, message, ...args);
                break;
            }
          },
        };

        const captureAuth = (
          event: PostHogEventName,
          userId: string,
          properties: Omit<PostHogCaptureProperties, 'surface'> = {},
        ) => {
          postHogService.capture({
            event,
            userId,
            properties: { surface: POSTHOG_SURFACE.AUTH, ...properties },
          });
        };

        return {
          auth: betterAuth(
            createAuthConfig({
              database,
              trustedOrigins: [webUrl],
              cookieDomain: configService.get('COOKIE_DOMAIN'),
              logger: betterAuthLogger,
              termsService,
              emailVerificationEnabled: shouldVerifyEmail,
              onSessionCreated: (userId) =>
                captureAuth(POSTHOG_EVENT.USER_LOG_IN, userId),
              onSessionDeleted: (userId) =>
                captureAuth(POSTHOG_EVENT.USER_LOG_OUT, userId),
              onUserCreated: (userId) =>
                captureAuth(POSTHOG_EVENT.USER_SIGN_UP, userId),
              onEmailVerified: (userId) =>
                captureAuth(POSTHOG_EVENT.USER_UPDATE, userId, {
                  source: 'email_verified',
                  updated_field: 'email_verified',
                }),
              onPasswordResetCompleted: (userId) =>
                captureAuth(POSTHOG_EVENT.USER_UPDATE, userId, {
                  source: 'password_reset',
                }),
              sendResetPassword: async ({ email, token, userId, headers }) => {
                const locale = await userLocaleService.resolveForUser(
                  userId,
                  headers,
                );
                const templateContext = createEmailTemplateContext(
                  appI18n,
                  locale,
                );
                const resetUrl = `${webUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
                const emailContent = await passwordResetTemplate(
                  {
                    resetUrl,
                    expiresInMinutes: 60,
                  },
                  templateContext,
                );

                await emailService.sendImmediately(
                  {
                    userId,
                    to: email,
                    ...emailContent,
                  },
                  new Date(Date.now() + 60 * 60 * 1000),
                );
                captureAuth(POSTHOG_EVENT.PASSWORD_RESET_SEND, userId);
              },
              sendVerificationOTP: async ({
                email,
                otp,
                type,
                headers,
                userId,
              }) => {
                // TODO: When enabling OTP sign-in or email change,
                // add type-specific templates here instead of sending generic copy.
                if (type !== 'email-verification') {
                  return;
                }

                const locale = userId
                  ? await userLocaleService.resolveForUser(userId, headers)
                  : await userLocaleService.resolveForEmail(email, headers);
                const templateContext = createEmailTemplateContext(
                  appI18n,
                  locale,
                );
                const emailContent = await accountVerificationOtpTemplate(
                  {
                    otp,
                    expiresInMinutes: 5,
                  },
                  templateContext,
                );

                await emailService.sendImmediately(
                  {
                    userId,
                    to: email,
                    ...emailContent,
                  },
                  new Date(Date.now() + 5 * 60 * 1000),
                );

                let otpUserId = userId;
                if (!otpUserId) {
                  const user = await database.query.users.findFirst({
                    where: { email },
                  });
                  otpUserId = user?.id;
                }
                if (otpUserId) {
                  captureAuth(POSTHOG_EVENT.OTP_SEND, otpUserId, {
                    source: type,
                  });
                }
              },
            }),
          ),
        };
      },
      inject: [
        DATABASE_CONNECTION,
        ConfigService,
        EmailService,
        UserLocaleService,
        AppI18nService,
        PostHogService,
        Logger,
        TermsService,
      ],
    }),
    UserModule,
    OrganizationModule,
    RequirementProfileModule,
    MembershipModule,
    MembershipLifecycleModule,
    NotificationModule,
    TimeTrackingModule,
    CheckInAgreementModule,
    GraphqlModule,
    HealthModule,
    LegalModule,
    ShiftModule,
    EventModule,
    StorageModule,
    TaskModule,
    TermsModule,
    BetterAuthModule,
    AuthModule,
    AccountingModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoaderInterceptor,
    },
    {
      provide: APP_GUARD,
      scope: Scope.REQUEST,
      useFactory: createSessionCachingAuthGuard,
      inject: [Reflector, AuthService],
    },
    {
      provide: APP_GUARD,
      scope: Scope.REQUEST,
      useFactory: (reflector: Reflector, termsService: TermsService) =>
        new TermsAcceptedGuard(reflector, termsService),
      inject: [Reflector, TermsService],
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule {}
