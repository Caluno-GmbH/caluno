'use client';

import type { FormBlock } from '@repo/data';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { FormBlockSection } from './form-block-section';
import type { BuilderBlockRef } from './form-builder-state';

interface FormBuilderPreviewProps {
  blockRefs: BuilderBlockRef[];
  availableBlocks: FormBlock[];
  /** Org display name for profile-field cards (same as volunteer forms). */
  formOrg: string;
}

export function FormBuilderPreview({
  blockRefs,
  availableBlocks,
  formOrg,
}: FormBuilderPreviewProps) {
  const t = useTranslations('RequirementForm.builder');
  const { control } = useForm<Record<string, string>>({});

  const blocks = useMemo(
    () =>
      blockRefs
        .map((ref) => availableBlocks.find((b) => b.id === ref.blockId))
        .filter((b): b is FormBlock => !!b),
    [blockRefs, availableBlocks],
  );

  return (
    <div className="rounded-lg border bg-muted/30 p-4 lg:min-h-0 lg:overflow-y-auto">
      <h3 className="mb-4 font-semibold">{t('previewTitle')}</h3>
      <div className="space-y-4">
        {blocks.map((block) => (
          <div key={block.id} className="rounded-lg border bg-card p-4">
            <FormBlockSection
              block={block}
              control={control}
              formOrg={formOrg}
            />
          </div>
        ))}
        {blocks.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('noPreview')}
          </p>
        )}
      </div>
    </div>
  );
}
