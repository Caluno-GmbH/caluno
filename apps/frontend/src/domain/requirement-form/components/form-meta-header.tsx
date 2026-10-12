'use client';

import { Button } from '@repo/ui';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CopyShareLinkButton } from './copy-share-link-button';
import { EditFormDialog } from './edit-form-dialog';

export function FormMetaHeader({
  orgUId,
  formId,
  name,
  description,
  shareToken,
  descriptionFallback,
}: {
  orgUId: string;
  formId: string;
  name: string;
  description: string | null | undefined;
  shareToken: string;
  descriptionFallback: string;
}) {
  const t = useTranslations('RequirementForm.form');
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between gap-4 lg:shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="page-title line-clamp-3" title={name}>
              {name}
            </h1>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              tooltip={t('editDetailsAria')}
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-4" />
              <span className="sr-only">{t('editDetailsAria')}</span>
            </Button>
          </div>
          <p className="text-muted-foreground mt-1">
            {description?.trim() ? description.trim() : descriptionFallback}
          </p>
        </div>
        <CopyShareLinkButton shareToken={shareToken} />
      </div>
      <EditFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        orgUId={orgUId}
        formId={formId}
        initialName={name}
        initialDescription={description}
      />
    </>
  );
}
