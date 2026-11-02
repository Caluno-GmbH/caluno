'use client';

import { Button } from '@repo/ui';
import { Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { copyToClipboard } from '@/lib/clipboard';

interface CopyEmailsButtonProps {
  emails: string[];
}

export function CopyEmailsButton({ emails }: CopyEmailsButtonProps) {
  const t = useTranslations('TimeEntry');

  return (
    <Button
      variant="default"
      size="sm"
      onClick={() =>
        copyToClipboard(
          emails.join(', '),
          t('table.emailsCopied', { count: emails.length }),
        )
      }
    >
      {t('table.copyEmails', { count: emails.length })}
      <Copy className="size-4" />
    </Button>
  );
}
