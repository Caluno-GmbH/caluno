'use client';

import { cn, Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui';
import { TriangleAlertIcon } from 'lucide-react';

interface AlertIconTooltipProps {
  hint: string;
  className?: string;
}

export function AlertIconTooltip({ hint, className }: AlertIconTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn('inline-flex shrink-0 cursor-default', className)}
          onClick={(e) => e.stopPropagation()}
        >
          <TriangleAlertIcon size={12} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
