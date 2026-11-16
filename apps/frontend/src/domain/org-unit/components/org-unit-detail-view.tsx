'use client';

import type {
  GetOrganizationUnitQuery,
  OrganizationUnitType,
} from '@repo/data';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { PencilIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSheetTrigger } from '@/hooks/use-sheet';
import { OrgUnitAboutContact } from './org-unit-about-contact';
import { FORM_ID, OrgUnitCreateEditSheet } from './org-unit-create-edit-sheet';

type OrganizationUnit = NonNullable<
  GetOrganizationUnitQuery['organizationUnit']
>;

interface OrgUnitDetailViewProps {
  orgUnit: OrganizationUnit;
  types: OrganizationUnitType[];
  canEdit: boolean;
  embedded?: boolean;
}

export function OrgUnitDetailView({
  orgUnit,
  types,
  canEdit,
  embedded = false,
}: OrgUnitDetailViewProps) {
  const { open } = useSheetTrigger(FORM_ID);
  const t = useTranslations('OrgUnit.detail');

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        {embedded ? (
          <h2 className="text-lg font-semibold">{orgUnit.name}</h2>
        ) : (
          <h1 className="page-title">{t('title')}</h1>
        )}
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => open({ id: orgUnit.id })}
          >
            <PencilIcon className="h-4 w-4" />
            {t('editButton')}
          </Button>
        )}
      </div>

      <OrgUnitAboutContact orgUnit={orgUnit} />

      {!embedded && orgUnit.parent && (
        <Card className="gap-2 py-4">
          <CardHeader>
            <CardTitle>{t('hierarchyTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="text-muted-foreground">{t('partOf')}</span>
              <span className="font-medium">{orgUnit.parent.name}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {!embedded && <OrgUnitCreateEditSheet types={types} />}
    </>
  );
}
