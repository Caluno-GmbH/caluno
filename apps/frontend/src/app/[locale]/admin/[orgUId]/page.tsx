import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminWelcomePage } from '@/domain/admin-welcome/admin-welcome-page';
import { EeSlot, resolveEeSlotComponent } from '@/edition/enterprise-slot';
import { resolveLocale } from '@/i18n/routing';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';
import { requireFound } from '@/lib/require-found';

interface AdminHomePageProps {
  params: Promise<{ orgUId: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: AdminHomePageProps): Promise<Metadata> {
  const { locale: rawLocale, orgUId } = await params;
  const locale = resolveLocale(rawLocale);
  const TodoPage = await resolveEeSlotComponent('todo-page');
  if (TodoPage) {
    const t = await getTranslations({ locale, namespace: 'Navigation' });
    return { title: `${t('todo')} — Caluno` };
  }
  await requireOrgAccess(orgUId);
  const data = await getDataClient({ orgUId, locale });
  const orgUnit = await requireFound(() =>
    data.organizationUnit.findById(orgUId),
  );
  const t = await getTranslations({ locale, namespace: 'AdminWelcome' });
  return {
    title: `${t('title', { orgUnitName: orgUnit.name })} — Caluno`,
  };
}

export default async function AdminHomePage({ params }: AdminHomePageProps) {
  const eeSlot = <EeSlot ee="todo-page" />;
  const TodoPage = await resolveEeSlotComponent('todo-page');
  if (TodoPage) {
    return <TodoPage params={params} />;
  }
  return <AdminWelcomePage params={params} />;
}
