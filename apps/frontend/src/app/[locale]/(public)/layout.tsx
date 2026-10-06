import { DataProvider } from '@repo/data/react';
import { headers } from 'next/headers';
import type { PropsWithChildren } from 'react';
import { VolunteerNav } from '@/components/navigation/volunteer-nav';
import { resolveLocale } from '@/i18n/routing';
import { isAuthenticated } from '@/lib/auth-server';
import { GRAPHQL_API_URL } from '@/lib/constants';
import { isAnAdminstrator } from '@/lib/org-context-server';
import {
  isTermsGateExempt,
  requireTermsAccepted,
} from '@/lib/terms-gate-server';

interface PublicLayoutProps extends PropsWithChildren {
  params: Promise<{ locale: string }>;
}

export default async function PublicLayout({
  children,
  params,
}: PublicLayoutProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const authenticated = await isAuthenticated();
  const pathname = (await headers()).get('x-pathname');
  // On exempt paths (e.g. unsubscribe) a pending user may still reach the page,
  // and the admin lookup is a gated GraphQL query that would 403.
  const gateExempt = isTermsGateExempt(pathname);

  if (authenticated && !gateExempt) {
    await requireTermsAccepted(locale);
  }

  const isAdmin =
    authenticated && !gateExempt ? await isAnAdminstrator() : false;

  return (
    <DataProvider apiUrl={GRAPHQL_API_URL} locale={locale}>
      <div className="flex min-h-screen flex-col">
        <main className="grow pb-24">{children}</main>
        {authenticated && <VolunteerNav isAdmin={isAdmin} />}
      </div>
    </DataProvider>
  );
}
