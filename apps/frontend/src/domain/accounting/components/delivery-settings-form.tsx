'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BundleDeliveryMethod,
  type RawAccountingDeliverySettings,
} from '@repo/data';
import { useUpdateAccountingDeliverySettings } from '@repo/data/react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  cn,
  FieldError,
  Input,
  ToggleGroup,
  ToggleGroupItem,
} from '@repo/ui';
import { InfoIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  buildDeliveryUpdate,
  createDeliveryDraft,
  type DeliveryDraft,
  type DeliveryFormValues,
  type DeliveryOwnFlags,
  draftFromValues,
  draftValues,
  insertSubjectPlaceholder,
  isDeliveryDraftDirty,
  isEmailMethod,
  ownAfterEdit,
  ownAfterRecipientEdit,
  ownFlags,
  sourceForDisplay,
} from '../lib/delivery-draft';
import { MAX_BUNDLE_SUBJECT_LENGTH } from '../lib/delivery-settings';
import { createDeliverySettingsSchema } from '../lib/delivery-settings-schema';
import { CharacterCounter } from './character-counter';
import { DeliveryFieldHeading } from './delivery-field-heading';
import { useSourceLabel } from './delivery-settings-source';
import { SubjectVariableChips } from './subject-variable-chips';

interface DeliverySettingsFormProps {
  settings: RawAccountingDeliverySettings;
  organizationUnitId: string;
}

export function DeliverySettingsForm({
  settings,
  organizationUnitId,
}: DeliverySettingsFormProps) {
  const t = useTranslations('Accounting.settings.delivery');
  const tCommon = useTranslations('Common');
  const sourceLabel = useSourceLabel();
  const update = useUpdateAccountingDeliverySettings(organizationUnitId);
  const ids = {
    method: useId(),
    methodHint: useId(),
    recipient: useId(),
    recipientHint: useId(),
    recipientError: useId(),
    subject: useId(),
    subjectHint: useId(),
    subjectError: useId(),
  };
  const subjectRef = useRef<HTMLInputElement>(null);
  const syncedSettingsRef = useRef(settings);
  const [initial, setInitial] = useState<DeliveryDraft>(() =>
    createDeliveryDraft(settings),
  );
  const [own, setOwn] = useState<DeliveryOwnFlags>(() => ownFlags(initial));
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);

  const schema = createDeliverySettingsSchema({
    invalidEmail: t('errors.invalidEmail'),
    recipientRequired: t('errors.recipientRequired'),
    unknownPlaceholder: t('errors.unknownPlaceholder'),
    tooLong: t('errors.subjectTooLong', { max: MAX_BUNDLE_SUBJECT_LENGTH }),
  });
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    watch,
    clearErrors,
    formState: { errors },
  } = useForm<DeliveryFormValues>({
    resolver: zodResolver(schema),
    defaultValues: draftValues(initial),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const values = watch();
  const emailDisabled = !isEmailMethod(values.method);
  const draft = draftFromValues(values, own);
  const dirty = isDeliveryDraftDirty(initial, draft, !emailDisabled);
  const saving = update.isPending;
  const resetLabel = t('reset.inherited');
  const inheritedRecipient = settings.inheritedRecipientEmail ?? '';

  // A sibling/ancestor save refetches these settings. Adopt the fresh values
  // only while the form has no unsaved edits, so a background refetch never
  // overwrites what the admin is typing.
  useEffect(() => {
    if (settings === syncedSettingsRef.current) return;
    if (dirty) return;
    syncedSettingsRef.current = settings;
    const next = createDeliveryDraft(settings);
    setInitial(next);
    reset(draftValues(next));
    setOwn(ownFlags(next));
    clearErrors();
  }, [settings, dirty, reset, clearErrors]);

  // Move the caret after a variable chip replaced the selection; focusing is
  // deferred so it happens after React has rendered the new value.
  useEffect(() => {
    if (pendingCaret === null) return;
    const input = subjectRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(pendingCaret, pendingCaret);
    setPendingCaret(null);
  }, [pendingCaret]);

  const recipientField = register('recipient');
  const subjectField = register('subject');

  function handleMethodChange(value: string) {
    const method = value as BundleDeliveryMethod;
    setValue('method', method, { shouldDirty: true, shouldValidate: false });
    setOwn((current) => ({
      ...current,
      method: ownAfterEdit(
        current.method,
        method,
        settings.inheritedDeliveryMethod,
      ),
    }));
    if (!isEmailMethod(method)) clearErrors(['recipient', 'subject']);
  }

  function handleRecipientChange(event: ChangeEvent<HTMLInputElement>) {
    recipientField.onChange(event);
    setOwn((current) => ({
      ...current,
      recipient: ownAfterRecipientEdit(
        current.recipient,
        event.target.value,
        inheritedRecipient,
      ),
    }));
  }

  function handleSubjectChange(event: ChangeEvent<HTMLInputElement>) {
    subjectField.onChange(event);
    setOwn((current) => ({
      ...current,
      subject: ownAfterEdit(
        current.subject,
        event.target.value,
        settings.inheritedEmailSubject,
      ),
    }));
  }

  function handleResetMethod() {
    const method = settings.inheritedDeliveryMethod;
    setValue('method', method, { shouldDirty: true, shouldValidate: false });
    setOwn((current) => ({ ...current, method: false }));
    if (!isEmailMethod(method)) clearErrors(['recipient', 'subject']);
  }

  function handleResetRecipient() {
    const validate = isEmailMethod(getValues('method'));
    setValue('recipient', inheritedRecipient, {
      shouldDirty: true,
      shouldValidate: validate,
    });
    setOwn((current) => ({ ...current, recipient: false }));
    if (!validate) clearErrors('recipient');
  }

  function handleResetSubject() {
    const validate = isEmailMethod(getValues('method'));
    setValue('subject', settings.inheritedEmailSubject, {
      shouldDirty: true,
      shouldValidate: validate,
    });
    setOwn((current) => ({ ...current, subject: false }));
    if (!validate) clearErrors('subject');
  }

  function handleInsertPlaceholder(name: string) {
    const input = subjectRef.current;
    const isFocused = input !== null && document.activeElement === input;
    const inserted = insertSubjectPlaceholder(
      getValues('subject'),
      `{${name}}`,
      isFocused ? input.selectionStart : null,
      isFocused ? input.selectionEnd : null,
    );
    setValue('subject', inserted.value, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setOwn((current) => ({
      ...current,
      subject: ownAfterEdit(
        current.subject,
        inserted.value,
        settings.inheritedEmailSubject,
      ),
    }));
    setPendingCaret(inserted.caret);
  }

  function handleCancel() {
    const current = createDeliveryDraft(settings);
    setInitial(current);
    reset(draftValues(current));
    setOwn(ownFlags(current));
    clearErrors();
  }

  async function handleSave(formValues: DeliveryFormValues) {
    const current = draftFromValues(formValues, own);
    const payload = buildDeliveryUpdate(
      initial,
      current,
      !isEmailMethod(formValues.method),
    );
    if (Object.keys(payload).length === 0) return;

    try {
      const result = await update.mutateAsync(payload);
      const saved = createDeliveryDraft(result);
      setInitial(saved);
      reset(draftValues(saved));
      setOwn(ownFlags(saved));
      clearErrors();
      toast.success(t('saveSuccess'));
    } catch {
      // The form checks what the server checks; a rejection here means the
      // inherited values changed meanwhile, so a reload shows the current state.
      toast.error(t('saveError'));
    }
  }

  const methodSource = sourceForDisplay(
    settings.deliveryMethodSource,
    draft.method.own,
  );
  const recipientSource = sourceForDisplay(
    settings.recipientEmailSource,
    draft.recipient.own,
  );
  const subjectSource = sourceForDisplay(
    settings.emailSubjectSource,
    draft.subject.own,
  );

  return (
    <form onSubmit={handleSubmit(handleSave)} noValidate className="space-y-6">
      <fieldset
        disabled={saving}
        className="m-0 min-w-0 space-y-6 border-0 p-0"
      >
        <div className="space-y-2">
          <DeliveryFieldHeading
            id={ids.method}
            label={t('methodLabel')}
            sourceLabel={sourceLabel(methodSource)}
            showReset={draft.method.own}
            resetLabel={resetLabel}
            onReset={handleResetMethod}
            disabled={saving}
          />
          <fieldset
            aria-labelledby={ids.method}
            aria-describedby={ids.methodHint}
            className="m-0 min-w-0 border-0 p-0"
          >
            <ToggleGroup
              type="single"
              variant="outline"
              size="lg"
              value={values.method}
              onValueChange={(value) => {
                if (
                  value === BundleDeliveryMethod.Download ||
                  value === BundleDeliveryMethod.Email
                ) {
                  handleMethodChange(value);
                }
              }}
            >
              <ToggleGroupItem value={BundleDeliveryMethod.Download}>
                {t('methodDownload')}
              </ToggleGroupItem>
              <ToggleGroupItem value={BundleDeliveryMethod.Email}>
                {t('methodEmail')}
              </ToggleGroupItem>
            </ToggleGroup>
          </fieldset>
          <p id={ids.methodHint} className="text-sm text-muted-foreground">
            {isEmailMethod(values.method)
              ? t('methodEmailHint')
              : t('methodDownloadHint')}
          </p>
        </div>

        {emailDisabled && (
          <Alert className="max-w-2xl">
            <InfoIcon aria-hidden="true" />
            <AlertTitle>{t('downloadAlert.title')}</AlertTitle>
            <AlertDescription>
              {t('downloadAlert.description')}
            </AlertDescription>
          </Alert>
        )}

        <fieldset
          disabled={emailDisabled}
          className={cn(
            'm-0 min-w-0 space-y-6 border-0 p-0 transition-opacity',
            emailDisabled && 'opacity-60',
          )}
        >
          <div className="space-y-1.5">
            <DeliveryFieldHeading
              label={t('recipientLabel')}
              htmlFor={ids.recipient}
              sourceLabel={sourceLabel(recipientSource)}
              showReset={draft.recipient.own}
              resetLabel={resetLabel}
              onReset={handleResetRecipient}
              disabled={saving || emailDisabled}
            />
            <Input
              id={ids.recipient}
              type="email"
              autoComplete="off"
              placeholder={t('recipientPlaceholder')}
              aria-invalid={!!errors.recipient}
              aria-describedby={[
                ids.recipientHint,
                errors.recipient ? ids.recipientError : null,
              ]
                .filter(Boolean)
                .join(' ')}
              className="max-w-md"
              {...recipientField}
              onChange={handleRecipientChange}
            />
            {errors.recipient && (
              <FieldError id={ids.recipientError}>
                {errors.recipient.message}
              </FieldError>
            )}
            <p id={ids.recipientHint} className="text-sm text-muted-foreground">
              {t('recipientHint')}
            </p>
          </div>

          <div className="space-y-2">
            <DeliveryFieldHeading
              label={t('subjectLabel')}
              htmlFor={ids.subject}
              sourceLabel={sourceLabel(subjectSource)}
              showReset={draft.subject.own}
              resetLabel={resetLabel}
              onReset={handleResetSubject}
              disabled={saving || emailDisabled}
            />
            <div className="flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2">
              <Input
                id={ids.subject}
                aria-invalid={!!errors.subject}
                aria-describedby={[
                  ids.subjectHint,
                  errors.subject ? ids.subjectError : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
                className="min-w-0 flex-1 sm:max-w-md"
                {...subjectField}
                ref={(element) => {
                  subjectRef.current = element;
                  subjectField.ref(element);
                }}
                onChange={handleSubjectChange}
              />
              <SubjectVariableChips
                disabled={saving || emailDisabled}
                onInsert={handleInsertPlaceholder}
              />
            </div>
            {errors.subject && (
              <FieldError id={ids.subjectError}>
                {errors.subject.message}
              </FieldError>
            )}
            <div className="flex w-full max-w-3xl items-start justify-between gap-3">
              <p id={ids.subjectHint} className="text-sm text-muted-foreground">
                {t('subjectHint')}
              </p>
              <CharacterCounter
                length={values.subject.length}
                max={MAX_BUNDLE_SUBJECT_LENGTH}
              />
            </div>
          </div>
        </fieldset>
      </fieldset>

      <div className="flex gap-2 pt-10">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={!dirty || saving}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </form>
  );
}
