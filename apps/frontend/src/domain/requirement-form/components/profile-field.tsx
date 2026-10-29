'use client';

import { Button, FieldDescription, FieldLabel } from '@repo/ui';
import { Check, Pencil, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { hasFixedGenderOptions, isGenderOptionValue } from '../gender-options';
import { parseMultiChoiceValue } from '../option-values';
import { FieldRenderer, type RenderableField } from './field-renderer';

/**
 * Volunteer-facing renderer for a profile-prefilled field.
 * Starts as a static muted card; edit opens an in-place editor with
 * confirm/cancel. Cancel restores the value from when edit started.
 */
export function ProfileField({
  field,
  value,
  onChange,
  error,
  formOrg,
  onCancel,
}: {
  field: RenderableField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  formOrg: string;
  onCancel?: () => void;
}) {
  const t = useTranslations('RequirementForm.volunteerForm');
  const tCommon = useTranslations('Common');
  const tGender = useTranslations('RequirementForm.genderOptions');
  const { formatDate } = useFormatting();
  const [editing, setEditing] = useState(false);
  const [snapshot, setSnapshot] = useState('');

  function handleStartEdit() {
    setSnapshot(value);
    setEditing(true);
  }

  function handleConfirmEdit() {
    setEditing(false);
  }

  function handleCancelEdit() {
    onChange(snapshot);
    onCancel?.();
    setEditing(false);
  }

  const displayValue = formatProfileFieldValue(value, field, {
    dash: tCommon('dash'),
    yes: tCommon('yes'),
    no: tCommon('no'),
    formatDate: (d) => formatDate(d, { dateStyle: 'long' }),
    genderLabel: (v) => (isGenderOptionValue(v) ? tGender(v) : v),
  });

  return (
    <div className="space-y-2">
      <FieldLabel>
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </FieldLabel>
      {field.description?.trim() && (
        <FieldDescription>{field.description.trim()}</FieldDescription>
      )}

      {editing ? (
        <div className="border-foreground bg-card relative space-y-3 rounded-lg border p-4">
          <p className="text-destructive pr-10 text-sm">
            {t('profileChangeWarning')}
          </p>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <FieldRenderer
                field={field}
                value={value}
                onChange={onChange}
                error={error}
                hideLabel
              />
            </div>
            <Button
              type="button"
              size="icon"
              className="size-9 shrink-0"
              onClick={handleConfirmEdit}
              aria-label={t('confirmEditAria')}
            >
              <Check className="size-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 size-8"
            onClick={handleCancelEdit}
            aria-label={t('cancelEditAria')}
          >
            <Undo2 className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="bg-muted relative rounded-lg px-4 py-3 pr-12">
          <p className="text-foreground mt-1 text-lg">{displayValue}</p>
          <p className="text-muted-foreground text-xs">
            {t('sharedWithOrg', { orgName: formOrg })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 size-8"
            onClick={handleStartEdit}
            aria-label={tCommon('edit')}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function formatProfileFieldValue(
  value: string,
  field: RenderableField,
  opts: {
    dash: string;
    yes: string;
    no: string;
    formatDate: (d: Date) => string;
    genderLabel: (v: string) => string;
  },
): string {
  if (!value) return opts.dash;

  if (field.type === 'CHECKBOX' || field.type === 'DOCUMENT_ACKNOWLEDGEMENT') {
    return value === 'true' ? opts.yes : opts.no;
  }

  if (field.type === 'DATE') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : opts.formatDate(d);
  }

  if (field.type === 'MULTI_CHOICE') {
    return parseMultiChoiceValue(value).join(', ') || opts.dash;
  }

  if (hasFixedGenderOptions(field.profileKey)) {
    return opts.genderLabel(value);
  }

  return value;
}
