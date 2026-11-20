'use client';

import { ActionTooltip, Button } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { BUNDLE_SUBJECT_PLACEHOLDERS } from '../lib/delivery-settings';

interface SubjectVariableChipsProps {
  disabled: boolean;
  onInsert: (name: string) => void;
}

/** Click-to-insert subject tokens, sized to sit beside the subject input. */
export function SubjectVariableChips({
  disabled,
  onInsert,
}: SubjectVariableChipsProps) {
  const t = useTranslations('Accounting.settings.delivery.variables');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {BUNDLE_SUBJECT_PLACEHOLDERS.map((name) => {
        const token = `{${name}}`;
        return (
          <ActionTooltip
            key={name}
            label={t('tooltip', {
              token,
              description: t(name),
            })}
          >
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="h-10 px-3 text-sm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onInsert(name)}
            >
              {token}
            </Button>
          </ActionTooltip>
        );
      })}
    </div>
  );
}
