'use client';

import { Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { copyToClipboard } from '@/lib/clipboard';

interface Props {
  email: string;
  volunteerName: string;
}

export function CopyableEmailCell({ email, volunteerName }: Props) {
  const t = useTranslations('Volunteer');

  return (
    <button
      type="button"
      onClick={() => copyToClipboard(email, t('table.emailCopied'))}
      aria-label={t('table.copyEmailAria', { name: volunteerName })}
      className="group flex items-center gap-1.5 rounded-sm text-left underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="truncate">{email}</span>
      <Copy className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 pointer-coarse:opacity-100" />
    </button>
  );
}
