import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { resolveAuthPageRedirects } from '@/lib/auth-page-redirect';
import { getSession } from '@/lib/auth-server';
import { SESSION_EXPIRED_REASON } from '@/lib/data-error-redirect';
import { resolvePendingInviteOrg } from '@/lib/pending-invite-org';
import { AuthPageShell } from '../auth-page-shell';
import { LoginForm } from './login-form';

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    redirectTo?: string;
    orgUId?: string;
    reason?: string;
  }>;
}

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Auth.login');
  const { redirectTo, orgUId, reason } = await searchParams;

  const [{ formRedirectTo, authenticatedRedirect }, joiningOrg] =
    await Promise.all([
      resolveAuthPageRedirects({ redirectTo }),
      resolvePendingInviteOrg(orgUId),
    ]);

  // After a client UNAUTHENTICATED the API rejected this session, so a
  // frontend session that still validates must not bounce back (loop).
  if (reason !== SESSION_EXPIRED_REASON && (await getSession())) {
    redirect({ href: await authenticatedRedirect(), locale });
  }

  return (
    <AuthPageShell
      title={t('title')}
      description={t('description')}
      joiningOrg={joiningOrg}
    >
      <LoginForm redirectTo={formRedirectTo} orgUId={joiningOrg?.id} />
    </AuthPageShell>
  );
}
