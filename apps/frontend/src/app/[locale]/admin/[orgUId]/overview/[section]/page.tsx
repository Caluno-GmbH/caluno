import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { OverviewSection } from '@/domain/overview/components/overview-section';
import { overviewSectionIdFromSlug } from '@/domain/overview/tasks';
import { resolveLocale } from '@/i18n/routing';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';

interface OverviewSectionPageProps {
  params: Promise<{ orgUId: string; locale: string; section: string }>;
}

export async function generateMetadata({
  params,
}: OverviewSectionPageProps): Promise<Metadata> {
  const { locale: rawLocale, section } = await params;
  const sectionId = overviewSectionIdFromSlug(section);
  if (!sectionId) return {};
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'Todo' });
  return { title: t(`sections.${sectionId}`) };
}

export default async function OverviewSectionPage({
  params,
}: OverviewSectionPageProps) {
  const { orgUId, locale: rawLocale, section } = await params;
  const sectionId = overviewSectionIdFromSlug(section);
  if (!sectionId) notFound();

  const locale = resolveLocale(rawLocale);
  await requireOrgAccess(orgUId);
  const data = await getDataClient({ orgUId, locale });
  const userPermissions = await data.user.getMyPermissions();

  return (
    <OverviewSection
      orgUId={orgUId}
      sectionId={sectionId}
      permissions={userPermissions.map((permission) => permission.key)}
    />
  );
}
