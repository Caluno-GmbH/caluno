'use client';

import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { OPTIONAL_COLUMN_IDS } from './volunteers-search-params';

interface ConfigureViewButtonProps {
  enabled: string[];
  onChange: (ids: string[]) => void;
  labels: Record<string, string>;
}

export const ConfigureViewButton = ({
  enabled,
  onChange,
  labels,
}: ConfigureViewButtonProps) => {
  const t = useTranslations('Volunteer');

  const toggle = (id: string, checked: boolean) => {
    const next = checked
      ? OPTIONAL_COLUMN_IDS.filter((col) => enabled.includes(col) || col === id)
      : OPTIONAL_COLUMN_IDS.filter(
          (col) => enabled.includes(col) && col !== id,
        );
    onChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-10">
          <SlidersHorizontal className="size-4" aria-hidden />
          {t('configureView.label')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) space-y-2 p-3"
      >
        {OPTIONAL_COLUMN_IDS.map((id) => {
          const checkboxId = `configure-view-${id}`;
          return (
            <div key={id} className="flex items-center gap-2">
              <Checkbox
                id={checkboxId}
                checked={enabled.includes(id)}
                onCheckedChange={(checked) => toggle(id, checked === true)}
              />
              <label htmlFor={checkboxId} className="text-sm">
                {labels[id]}
              </label>
            </div>
          );
        })}
        <p className="text-muted-foreground text-xs">
          {t('configureView.note')}
        </p>
      </PopoverContent>
    </Popover>
  );
};
