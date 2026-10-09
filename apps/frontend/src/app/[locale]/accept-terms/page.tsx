import { DataProvider } from '@repo/data/react';
import { Suspense } from 'react';
import { redirect } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/routing';
import { getSession } from '@/lib/auth-server';
import { GRAPHQL_API_URL } from '@/lib/constants';
import { fetchTermsStatus } from '@/lib/terms-gate-server';
import { TermsAcceptance } from './terms-acceptance';
import { TermsStatusError } from './terms-status-error';

export default async function AcceptTermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);

  const session = await getSession();
  if (!session?.user) {
    redirect({ href: '/login', locale });
  }

  const status = await fetchTermsStatus();
  if (status && !status.mustAccept) {
    redirect({ href: '/', locale });
  }

  if (!status) {
    return (
      <DataProvider apiUrl={GRAPHQL_API_URL} locale={locale}>
        <TermsStatusError />
      </DataProvider>
    );
  }

  return (
    <DataProvider apiUrl={GRAPHQL_API_URL} locale={locale}>
      <Suspense>
        <TermsAcceptance
          locale={locale}
          currentVersion={status?.currentVersion ?? null}
        />
      </Suspense>
    </DataProvider>
  );
}
