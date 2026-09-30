'use client';
import type { BetterAuthClientOptions } from 'better-auth/client';
import {
  emailOTPClient,
  inferAdditionalFields,
} from 'better-auth/client/plugins';
import { createAuthClient as createBetterAuthClient } from 'better-auth/react';
import type { Session } from 'better-auth/types';
import { LOCALE_HEADER } from '../../constants';
import { clearLastVisitedOrg } from '../org-context';
import { clearLocaleCookie } from './locale-cookie';
import { readRequestLocale } from './read-request-locale';

const additionalFieldsClient = inferAdditionalFields({
  user: {
    locale: {
      type: 'string',
      required: false,
    },
    privacyPolicyAccepted: {
      type: 'boolean',
      required: false,
      returned: false,
    },
    privacyPolicyVersion: {
      type: 'string',
      required: false,
    },
    privacyPolicyAcceptedAt: {
      type: 'date',
      required: false,
      input: false,
    },
  },
});

type CalunoAuthClientOptions = BetterAuthClientOptions & {
  baseURL: string;
  plugins: [ReturnType<typeof emailOTPClient>, typeof additionalFieldsClient];
};

type BaseReactAuthClient = ReturnType<
  typeof createBetterAuthClient<CalunoAuthClientOptions>
>;

export type AuthClient = Omit<BaseReactAuthClient, 'signOut'> & {
  signOut: BaseReactAuthClient['signOut'];
};

export function createAuthClient(baseURL: string): AuthClient {
  const client = createBetterAuthClient({
    baseURL,
    plugins: [emailOTPClient(), additionalFieldsClient],
    fetchOptions: {
      onRequest: (context) => {
        context.headers.set(LOCALE_HEADER, readRequestLocale());
      },
    },
  });

  // Better Auth returns a Proxy whose get trap ignores own properties set via
  // Object.assign — so a wrapped `signOut` assigned onto the client is never
  // called. Capture the real sign-out callable, then wrap the client in an
  // outer Proxy that intercepts `signOut`.
  const betterAuthSignOut = client.signOut;

  const signOut = (async (...args: Parameters<typeof client.signOut>) => {
    clearLastVisitedOrg();
    clearLocaleCookie();
    return await betterAuthSignOut(...args);
  }) as typeof client.signOut;

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'signOut') {
        return signOut;
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as AuthClient;
}

export type { Session };
