'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
} from '@repo/ui';
import { Save, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { updateForm } from '../actions';

export function EditFormDialog({
  open,
  onOpenChange,
  orgUId,
  formId,
  initialName,
  initialDescription,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgUId: string;
  formId: string;
  initialName: string;
  initialDescription: string | null | undefined;
}) {
  const router = useRouter();
  const t = useTranslations('RequirementForm.form');
  const tActions = useTranslations('RequirementForm.actions');
  const tValidation = useTranslations('RequirementForm.validation');
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription ?? '');
      setNameError(null);
    }
  }, [open, initialName, initialDescription]);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(tValidation('nameRequired'));
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      const result = await updateForm({
        organizationUnitId: orgUId,
        formId,
        name: trimmedName,
        description,
      });
      if (result?.serverError) {
        toast.error(result.serverError);
      } else if (result?.data) {
        toast.success(tActions('formDetailsSaved'));
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(tActions('failedToSaveForm'));
      }
    } catch {
      toast.error(tActions('failedToSaveForm'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('editDialogTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          <Field>
            <FieldLabel htmlFor="edit-form-name">{t('nameLabel')}</FieldLabel>
            <Input
              id="edit-form-name"
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              className="h-11 text-base"
              aria-invalid={!!nameError}
            />
            {nameError && (
              <p className="text-destructive text-sm">{nameError}</p>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-form-desc">
              {t('descriptionOptional')}
            </FieldLabel>
            <Input
              id="edit-form-desc"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-11 text-base"
            />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              size="lg"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              <X />
              {t('cancel')}
            </Button>
            <Button
              size="lg"
              onClick={handleSave}
              disabled={!name.trim() || saving}
            >
              <Save />
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
