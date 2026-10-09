import { PermissionKey } from '@repo/data';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { OrgUnitDetailView } from '@/domain/org-unit/components/org-unit-detail-view';
import { OrgUnitSetup } from '@/domain/org-unit/components/org-unit-setup';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';
import { checkPermission, requirePermission } from '@/lib/permissions-server';

interface OrgUnitsPageProps {
  params: Promise<{ orgUId: string; locale: string }>;
}

export default async function OrgUnitsPage({ params }: OrgUnitsPageProps) {
  const { orgUId, locale } = await params;
  const { org } = await requireOrgAccess(orgUId);
  await requirePermission(orgUId, PermissionKey.OrgView);

  const data = await getDataClient({ orgUId });
  const t = await getTranslations({ locale, namespace: 'OrgUnit' });

  const [[canEdit], tree, types, currentUnit] = await Promise.all([
    checkPermission(orgUId, PermissionKey.OrgEdit),
    data.organizationUnit.findOrganizationTree(),
    data.organizationUnit.findAllTypes(),
    data.organizationUnit.findById(orgUId),
  ]);

  if (!currentUnit) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t('page.title')}</h1>

        <p className="text-muted-foreground mt-1">
          {t('page.subtitle', { orgName: org.name })}
        </p>
      </div>

      <Suspense fallback={null}>
        <OrgUnitDetailView
          orgUnit={currentUnit}
          types={types}
          canEdit={canEdit ?? false}
          embedded
        />
      </Suspense>

      <OrgUnitSetup
        canEdit={canEdit}
        tree={tree}
        types={types}
        organizationUnitId={orgUId}
      />
    </div>
  );
}
