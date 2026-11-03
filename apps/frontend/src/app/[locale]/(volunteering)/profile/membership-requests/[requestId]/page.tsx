import { getTranslations } from 'next-intl/server';
import { MembershipDetailHeader } from '@/domain/memberships/components/membership-detail-header';
import { MembershipFormCard } from '@/domain/memberships/components/membership-form-card';
import { MembershipStatusBadge } from '@/domain/memberships/components/membership-status-badge';
import { mergeOrgUnitFormsWithSubmissions } from '@/domain/memberships/lib/merge-org-unit-forms';
import { resolveLocale } from '@/i18n/routing';
import { getDataClient } from '@/lib/data-client';
import { getFormatting } from '@/lib/formatting/formatting-server';
import { requireFound } from '@/lib/require-found';

type Props = {
  params: Promise<{ locale: string; requestId: string }>;
};

export default async function MembershipRequestDetailPage({ params }: Props) {
  const { locale: rawLocale, requestId } = await params;
  resolveLocale(rawLocale);

  const data = await getDataClient();
  const request = await requireFound(() =>
    data.membershipRequest.findMineById(requestId),
  );

  const organizationUnitId = request.organizationUnit.id;
  const [requiredForms, submissions] = await Promise.all([
    data.requirementForm.findMyRequiredOrgUnitForms(organizationUnitId),
    data.requirementForm.findMyFormSubmissions(organizationUnitId),
  ]);
  const forms = mergeOrgUnitFormsWithSubmissions(
    requiredForms,
    submissions,
    organizationUnitId,
  );

  const t = await getTranslations('MembershipDetail');
  const tRequest = await getTranslations('MembershipRequest');
  const { formatDate } = await getFormatting();

  const orgUnit = request.organizationUnit;
  const title = orgUnit.parent
    ? `${orgUnit.organization.name} · ${orgUnit.name}`
    : orgUnit.organization.name;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-30">
        <MembershipDetailHeader title={title} logoUrl={orgUnit.logoUrl} />
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6">
        <section className="space-y-1">
          <MembershipStatusBadge state="requested" />
          <p className="text-muted-foreground">
            {tRequest('meta.requestedDate', {
              date: formatDate(new Date(request.createdAt)),
            })}
          </p>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{t('forms.title')}</h2>
            <p className="text-muted-foreground text-sm">
              {t('forms.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {forms.map((submission) => (
              <MembershipFormCard
                key={submission.form.id}
                submission={submission}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
