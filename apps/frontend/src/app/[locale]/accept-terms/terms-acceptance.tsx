'use client';

import { useAcceptTerms } from '@repo/data/react';
import { Button } from '@repo/ui';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { termsPdfVersionedUrl } from '@/lib/terms';
import { resolveNextPath } from '@/lib/terms-next-path';

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
  const readyRef = useRef(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [renderError, setRenderError] = useState(false);

  const checkEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !readyRef.current) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
      setHasReachedEnd(true);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkEnd);
    checkEnd();
    return () => el.removeEventListener('scroll', checkEnd);
  }, [checkEnd]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => checkEnd());
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkEnd]);

  useEffect(() => {
    if (!currentVersion) return;
    let cancelled = false;
    const renderTasks: { cancel: () => void }[] = [];
    let loadingTask: PDFDocumentLoadingTask | null = null;

    readyRef.current = false;
    setHasReachedEnd(false);
    setRenderError(false);

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();

        loadingTask = pdfjs.getDocument({
          url: termsPdfVersionedUrl(currentVersion, locale),
        });
        const pdf = await loadingTask.promise;

        const container = contentRef.current;
        if (!container || cancelled) return;
        container.innerHTML = '';

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

        if (cancelled) return;
        readyRef.current = true;
        checkEnd();
      } catch {
        if (!cancelled) {
          readyRef.current = false;
          setHasReachedEnd(false);
          setRenderError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      for (const task of renderTasks) {
        task.cancel();
      }
      loadingTask?.destroy().catch(() => {});
      if (contentRef.current) {
        contentRef.current.innerHTML = '';
      }
    };
  }, [currentVersion, locale, checkEnd]);

  const accept = () => {
    if (!currentVersion) return;
    acceptTerms.reset();
    acceptTerms.mutate(
      { version: currentVersion, language: locale },
      {
        onSuccess: () => {
          router.push(resolveNextPath(searchParams.get('next')));
          router.refresh();
        },
      },
    );
  };

  const label = acceptTerms.isPending
    ? t('accepting')
    : acceptTerms.isSuccess
      ? t('redirecting')
      : t('accept');

  return (
    <div className="flex h-screen flex-col">
      <div
        ref={scrollRef}
        data-testid="terms-scroll"
        className="flex-1 overflow-y-auto p-4"
      >
        <div ref={contentRef} className="mx-auto max-w-3xl" />
        {renderError && (
          <p className="mx-auto max-w-3xl py-8 text-center text-muted-foreground text-sm">
            {t('loadFailed')}
          </p>
        )}
      </div>
      <div className="flex flex-col items-center gap-3 border-t bg-background p-4">
        {acceptTerms.isError && (
          <p className="text-sm text-destructive">{t('acceptFailed')}</p>
        )}
        <Button
          className="min-w-48 px-8"
          disabled={
            !hasReachedEnd || acceptTerms.isPending || acceptTerms.isSuccess
          }
          onClick={accept}
        >
          {label}
        </Button>
      </div>
    </div>
  );
}
