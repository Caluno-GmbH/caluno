'use client';

import type { OrgOverrideSource } from '@repo/data';
import { useTranslations } from 'next-intl';
import { ProfileFieldCard } from '@/components/profile-field-card';

interface BuilderOrgOverrideCardProps {
  source: OrgOverrideSource;
  /** What the organisation itself says, shown whenever nothing was typed here. */
  orgValue: string | undefined;
  /** What the coordinator typed for this template, if anything. */
  override: string | undefined;
  onChange: (value: string) => void;
}

/**
 * One organisation detail on a document template: the organisation's own value
 * by default, editable with the pencil when this template's counterpart is a
 * different body.
 *
 * Clearing the field is how the override is undone — there is no separate
 * revert control, and the subline says which of the two is in force, which is
 * what VOLI-1214 found a bare pencil failed to communicate.
 */
export function BuilderOrgOverrideCard({
  source,
  orgValue,
  override,
  onChange,
}: BuilderOrgOverrideCardProps) {
  const t = useTranslations('Accounting.templates.builder');
  const tSources = useTranslations('Accounting.templates.builder.dataSources');

  const isOverridden = (override ?? '').trim() !== '';
  const value = isOverridden ? (override ?? '') : (orgValue ?? '');

  return (
    <ProfileFieldCard
      label={tSources(source as Parameters<typeof tSources>[0])}
      value={value || null}
      missingValueLabel={t('orgOverride.missingValue')}
      subline={
        isOverridden
          ? t('orgOverride.overriddenHint')
          : t('orgOverride.orgHint')
      }
      editingSubline={t('orgOverride.editingHint')}
      editButtonLabel={t('orgOverride.editButtonLabel')}
      saveButtonLabel={t('orgOverride.saveButtonLabel')}
      isEmptyValue={!value}
      onSave={onChange}
    />
  );
}
