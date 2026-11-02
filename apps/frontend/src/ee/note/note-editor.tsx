'use client';

import { useMyNote, useUpdateMyNote } from '@repo/data/ee';
import { Button, Textarea } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type NoteEditorProps = {
  /** Optional heading rendered above the field (admin page supplies its own). */
  showHeading?: boolean;
};

export function NoteEditor({ showHeading = true }: NoteEditorProps) {
  const t = useTranslations('EeNote');
  const tCommon = useTranslations('Common');
  const { data, isLoading, isError } = useMyNote();
  const updateNote = useUpdateMyNote();
  const [body, setBody] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (data && !initialized) {
      setBody(data.body);
      setInitialized(true);
    }
  }, [data, initialized]);

  const dirty = initialized && body !== (data?.body ?? '');

  const handleSave = async () => {
    try {
      const saved = await updateNote.mutateAsync({ body });
      setBody(saved.body);
      toast.success(t('saved'));
    } catch {
      toast.error(t('saveFailed'));
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive">{t('loadFailed')}</p>;
  }

  return (
    <div className="space-y-4">
      {showHeading ? <h2 className="text-xl font-bold">{t('title')}</h2> : null}
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={8}
        className="min-h-40"
        placeholder={t('placeholder')}
        aria-label={t('title')}
      />
      <Button
        type="button"
        onClick={handleSave}
        disabled={!dirty || updateNote.isPending}
      >
        {updateNote.isPending ? t('saving') : tCommon('save')}
      </Button>
    </div>
  );
}
