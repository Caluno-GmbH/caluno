'use client';

import { useAcceptTerms } from '@repo/data/react';
import { Button } from '@repo/ui';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { termsPdfVersionedUrl } from '@/lib/terms';

interface TermsAcceptanceProps {
  locale: Locale;
  currentVersion: string | null;
}

export function TermsAcceptance({
  locale,
  currentVersion,
}: TermsAcceptanceProps) {
  const t = useTranslations('Terms');
  const router = useRouter();
  const searchParams = useSearchParams();
  const acceptTerms = useAcceptTerms();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
        setHasReachedEnd(true);
      }
    };
    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!currentVersion) return;
    let cancelled = false;
    const renderTasks: { cancel: () => void }[] = [];
    let loadingTask: PDFDocumentLoadingTask | null = null;

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();

        loadingTask = pdfjs.getDocument({
          url: termsPdfVersionedUrl(currentVersion, locale),
        });
        const pdf = await loadingTask.promise;

        const container = contentRef.current;
        if (!container || cancelled) return;
        container.innerHTML = '';
        setHasReachedEnd(false);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.marginBottom = '16px';
          container.appendChild(canvas);
          const task = page.render({ canvas, viewport });
          renderTasks.push(task);
          await task.promise;
        }

        const scrollEl = scrollRef.current;
        if (
          scrollEl &&
          scrollEl.scrollTop + scrollEl.clientHeight >=
            scrollEl.scrollHeight - 8
        ) {
          setHasReachedEnd(true);
        }
      } catch {
        if (!cancelled) {
          setRenderError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const task of renderTasks) {
        task.cancel();
      }
      loadingTask?.destroy().catch(() => {});
      if (contentRef.current) {
        contentRef.current.innerHTML = '';
      }
    };
  }, [currentVersion, locale]);

  const accept = () => {
    if (!currentVersion) return;
    acceptTerms.mutate(
      { version: currentVersion, language: locale },
      {
        onSuccess: () => {
          const next = searchParams.get('next') ?? '/';
          router.push(next);
          router.refresh();
        },
      },
    );
  };

  return (
    <div className="flex h-screen flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div ref={contentRef} className="mx-auto max-w-3xl" />
        {renderError && (
          <p className="mx-auto max-w-3xl py-8 text-center text-muted-foreground text-sm">
            {t('loadFailed')}
          </p>
        )}
      </div>
      <div className="border-t bg-background p-4">
        <Button
          className="w-full"
          disabled={!hasReachedEnd || acceptTerms.isPending}
          onClick={accept}
        >
          {acceptTerms.isPending ? t('accepting') : t('accept')}
        </Button>
      </div>
    </div>
  );
}
