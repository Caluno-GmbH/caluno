'use client';

import { Button, FieldError, Input } from '@repo/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { duplicateOptionIndexes } from '../option-values';

interface OptionItem {
  id: string;
  label: string;
}

function toItems(options: string[]): OptionItem[] {
  return options.map((label) => ({ id: crypto.randomUUID(), label }));
}

export function OptionsEditor({
  options,
  onChange,
  disabled,
  error,
}: {
  options: string[];
  onChange: (options: string[]) => void;
  disabled?: boolean;
  error?: string;
}) {
  const t = useTranslations('RequirementForm.block');
  const tCommon = useTranslations('Common');
  const [items, setItems] = useState<OptionItem[]>(() => toItems(options));
  const duplicateIndexes = new Set(
    duplicateOptionIndexes(items.map((item) => item.label)),
  );

  function update(index: number, next: string) {
    const updated = items.map((item, i) =>
      i === index ? { ...item, label: next } : item,
    );
    setItems(updated);
    onChange(updated.map(({ label }) => label));
  }

  function add() {
    const updated = [...items, { id: crypto.randomUUID(), label: '' }];
    setItems(updated);
    onChange(updated.map(({ label }) => label));
  }

  function remove(index: number) {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    onChange(updated.map(({ label }) => label));
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const isInvalid =
          !!error && (item.label.trim() === '' || duplicateIndexes.has(idx));
        return (
          <div key={item.id} className="flex items-center gap-2">
            <Input
              value={item.label}
              onChange={(e) => update(idx, e.target.value)}
              placeholder={t('optionPlaceholder', { n: idx + 1 })}
              className="flex-1"
              disabled={disabled}
              aria-invalid={isInvalid}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive shrink-0"
              tooltip={tCommon('delete')}
              disabled={disabled}
              onClick={() => remove(idx)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={disabled}
      >
        <Plus className="mr-1 size-4" />
        {t('addOption')}
      </Button>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
