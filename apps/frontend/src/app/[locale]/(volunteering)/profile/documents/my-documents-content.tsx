import { getTranslations } from 'next-intl/server';
import { VolunteerMyDocuments } from '@/domain/accounting/components/volunteer-my-documents';
import { VolunteerMyDocumentsHeader } from '@/domain/accounting/components/volunteer-my-documents-header';

/**
 * The volunteer's cross-org "My documents" list — every document they are
 * party to across all their organizations, grouped per org. Shared by the
 * list page and the complete-profile fallback page, so a hard load of the
 * sheet URL renders the list behind the open sheet.
 */
export async function MyDocumentsContent() {
  const t = await getTranslations('MyDocuments');

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-30">
        <VolunteerMyDocumentsHeader title={t('title')} />
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6">
        <VolunteerMyDocuments />
      </div>
    </div>
  );
}
