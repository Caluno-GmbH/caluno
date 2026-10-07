'use client';

import type { OrganizationUnitType, OrgUnitTreeNode } from '@repo/data';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useSheetTrigger } from '@/hooks/use-sheet';
import {
  FORM_ID as CREATE_EDIT_FORM_ID,
  OrgUnitCreateEditSheet,
} from './org-unit-create-edit-sheet';
import { OrgUnitDeletionRequestDialog } from './org-unit-deletion-request-dialog';
import { OrgUnitTree } from './org-unit-tree';

interface OrgUnitSetupClientProps {
  tree: OrgUnitTreeNode | null;
  types: OrganizationUnitType[];
  organizationUnitId: string;
  canEdit?: boolean;
}

export function OrgUnitSetup({
  tree,
  types,
  organizationUnitId,
  canEdit = false,
}: OrgUnitSetupClientProps) {
  const [orgUnitToDelete, setOrgUnitToDelete] =
    useState<OrgUnitTreeNode | null>(null);

  const { open: openOrgUnitSheet } = useSheetTrigger(CREATE_EDIT_FORM_ID);
  const t = useTranslations('OrgUnit.tree');

  const treeCard = (
    <Card className="gap-2 py-4">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {tree ? (
          <OrgUnitTree
            root={tree}
            onCreate={(parentNode) =>
              openOrgUnitSheet({ parentId: parentNode.id })
            }
            onEdit={(node) => openOrgUnitSheet({ id: node.id })}
            onDelete={setOrgUnitToDelete}
            canEdit={canEdit}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        )}
      </CardContent>
    </Card>
  );

  if (!tree) {
    return treeCard;
  }

  return (
    <>
      {treeCard}

      <OrgUnitCreateEditSheet types={types} />

      <OrgUnitDeletionRequestDialog
        open={orgUnitToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setOrgUnitToDelete(null);
        }}
        organizationUnitId={organizationUnitId}
        unit={orgUnitToDelete}
      />
    </>
  );
}
