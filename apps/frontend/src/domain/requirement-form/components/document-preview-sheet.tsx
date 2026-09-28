'use client';

import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@repo/ui';
import { ExternalLink, Link } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DocumentPreviewSheetProps {
  label: string;
  filename: string;
  downloadUrl: string;
}

// Opens the document inside the page instead of a new tab. In-app browsers
// (GMX, Slack, ...) treat a new tab as leaving the flow, so closing the
// document there drops the volunteer back into the other app.
export function DocumentPreviewSheet({
  label,
  filename,
  downloadUrl,
}: DocumentPreviewSheetProps) {
  const t = useTranslations('RequirementForm.volunteerForm');

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex max-w-full items-center gap-1 text-left underline-offset-2 hover:underline"
        >
          <span className="min-w-0 break-all">{label}</span>
          <Link className="size-3 shrink-0" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[90dvh] gap-0 rounded-t-xl">
        <SheetHeader className="pr-14">
          <SheetTitle className="break-all">{filename}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 px-4">
          <iframe
            src={downloadUrl}
            title={filename}
            className="h-full w-full rounded-xl border border-border bg-card"
          />
        </div>
        <SheetFooter>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center gap-1 text-sm text-muted-foreground underline underline-offset-2"
          >
            {t('documentOpenInNewTab')}
            <ExternalLink className="size-3 shrink-0" />
          </a>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
