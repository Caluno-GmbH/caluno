import type { ReactNode } from 'react';
import { resolveLocale } from '@/i18n/routing';
import { requireAuth } from '@/lib/auth-server';
import { requireTermsAccepted } from '@/lib/terms-gate-server';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  await requireAuth();
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);

  await requireTermsAccepted(locale);

  return <>{children}</>;
}
