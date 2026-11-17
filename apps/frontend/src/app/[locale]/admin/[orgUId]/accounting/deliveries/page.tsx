import { PermissionKey } from '@repo/data';
import { getTranslations } from 'next-intl/server';
import { BundleDeliveryLog } from '@/domain/accounting/components/bundle-delivery-log';
import { requirePermission } from '@/lib/permissions-server';

interface DeliveriesPageProps {
  params: Promise<{ orgUId: string; locale: string }>;
}

export default async function DeliveriesPage({ params }: DeliveriesPageProps) {
  const { locale, orgUId } = await params;
  await requirePermission(orgUId, PermissionKey.AccountingManage);
  const t = await getTranslations({
    locale,
    namespace: 'Accounting.deliveries',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>
      <BundleDeliveryLog key={orgUId} orgUId={orgUId} />
    </div>
  );
}
