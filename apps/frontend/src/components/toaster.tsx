'use client';

import { Toaster as UiToaster } from '@repo/ui';
import { useTheme } from '@teispace/next-themes';
import type { ComponentProps } from 'react';

export function Toaster(props: ComponentProps<typeof UiToaster>) {
  const { resolvedTheme } = useTheme();

  return (
    <UiToaster
      theme={
        (resolvedTheme ?? 'system') as ComponentProps<typeof UiToaster>['theme']
      }
      {...props}
    />
  );
}
