'use client';

import {
  AccountingSettingSourceKind,
  BundleDeliveryMethod,
  type RawAccountingDeliverySettings,
} from '@repo/data';
import {
  useAccountingDeliverySettings,
  useCurrentOrg,
  useUpdateAccountingDeliverySettings,
} from '@repo/data/react';
import {
  ActionTooltip,
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  cn,
  FieldLegend,
  FieldSet,
  Input,
  Label,
  Separator,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
} from '@repo/ui';
import { AlertCircleIcon, Info, Plus, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type GuardedNavigation,
  stripKnownLocalePrefix,
  useUnsavedChangesGuard,
} from '@/hooks/use-unsaved-changes-guard';
import { useRouter } from '@/i18n/navigation';
import {
  BUNDLE_SUBJECT_PLACEHOLDERS,
  hasUnknownSubjectPlaceholder,
  isValidEmail,
} from '../lib/delivery-settings';

interface DeliverySettingsCardProps {
  canEdit: boolean;
  organizationUnitId: string;
}

export function DeliverySettingsCard({
  canEdit,
  organizationUnitId,
}: DeliverySettingsCardProps) {
  const t = useTranslations('Accounting.settings.delivery');
  const query = useAccountingDeliverySettings(organizationUnitId);

  if (query.isLoading) return <DeliverySettingsSkeleton />;
  if (query.isError || !query.data) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
        <AlertCircleIcon
          size={16}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <p>{t('loadError')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('sectionTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('sectionSubtitle')}
        </p>
      </div>
      <DeliverySettingsForm
        settings={query.data}
        organizationUnitId={organizationUnitId}
        canEdit={canEdit}
      />
    </div>
  );
}

/** Splices `token` into `text` at [start, end), returns new string and new caret pos. */
function insertAtSelection(
  text: string,
  token: string,
  start: number,
  end: number,
): { next: string; caret: number } {
  const next = text.slice(0, start) + token + text.slice(end);
  return { next, caret: start + token.length };
}

// Purely informational: the source line attaches under the field title as muted
// helper text, with the reset-to-inherited action sitting to its right.
function InheritanceNote({
  sourceKind,
  sourceName,
  onReset,
}: {
  sourceKind: AccountingSettingSourceKind;
  sourceName: string | null | undefined;
  onReset: () => void;
}) {
  const t = useTranslations('Accounting.settings.delivery');
  const isOwn = sourceKind === AccountingSettingSourceKind.Own;
  const text = isOwn
    ? t('source.own')
    : sourceKind === AccountingSettingSourceKind.Inherited
      ? t('source.inheritedFrom', { source: sourceName ?? '' })
      : t('source.default');

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>
        <span aria-hidden="true">· </span>
        {text}
      </span>
      {isOwn && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto gap-1 px-0 py-0 text-xs font-normal text-muted-foreground"
          onClick={onReset}
        >
          <Undo2 className="size-3" />
          {t('resetToInherited')}
        </Button>
      )}
    </div>
  );
}

const SUBJECT_MAX_LENGTH = 200;

function DeliverySettingsForm({
  settings,
  organizationUnitId,
  canEdit,
}: {
  settings: RawAccountingDeliverySettings;
  organizationUnitId: string;
  canEdit: boolean;
}) {
  const t = useTranslations('Accounting.settings.delivery');
  const tCommon = useTranslations('Common');
  const update = useUpdateAccountingDeliverySettings(organizationUnitId);
  const { isRoot } = useCurrentOrg();
  const router = useRouter();
  const ids = {
    legend: useId(),
    recipient: useId(),
    recipientHint: useId(),
    recipientError: useId(),
    subject: useId(),
    subjectError: useId(),
  };

  // Per-field tri-state: null = "inherit" (send null to clear override), value = own override.
  const [ownMethod, setOwnMethod] = useState<BundleDeliveryMethod | null>(
    settings.ownDeliveryMethod ?? null,
  );
  const [ownRecipient, setOwnRecipient] = useState<string | null>(
    settings.ownRecipientEmail ?? null,
  );
  const [ownSubject, setOwnSubject] = useState<string | null>(
    settings.ownEmailSubject ?? null,
  );
  const [errors, setErrors] = useState<{
    recipient?: string;
    subject?: string;
  }>({});
  const [pendingNavigation, setPendingNavigation] =
    useState<GuardedNavigation | null>(null);

  const subjectInputRef = useRef<HTMLInputElement>(null);
  // Track caret so chip inserts land at the right position.
  const caretRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  // The displayed (editable) value for each field: own override or fall back to inherited.
  const effectiveMethod = ownMethod ?? settings.inheritedDeliveryMethod;
  const displayRecipient =
    ownRecipient ?? settings.inheritedRecipientEmail ?? '';
  const displaySubject = ownSubject ?? settings.inheritedEmailSubject ?? '';

  // Dirty if any field differs from what the server gave us. Recipient/subject
  // are normalized the same way handleSave persists them, so clearing a field
  // to whitespace (which saves as null) doesn't leave the form stuck dirty.
  const dirty =
    ownMethod !== (settings.ownDeliveryMethod ?? null) ||
    (ownRecipient?.trim() || null) !== (settings.ownRecipientEmail ?? null) ||
    (ownSubject?.trim() || null) !== (settings.ownEmailSubject ?? null);

  const { release: releaseNavigationGuard } = useUnsavedChangesGuard({
    enabled: dirty,
    onPrompt: setPendingNavigation,
  });

  function handleLeave() {
    const target = pendingNavigation;
    setPendingNavigation(null);
    if (!target) return;
    releaseNavigationGuard();
    if (target.type === 'back') {
      if (target.delta === null) {
        router.push(`/admin/${organizationUnitId}`);
        return;
      }
      window.history.go(target.delta);
      return;
    }
    router.push(stripKnownLocalePrefix(target.href));
  }

  function handleCancel() {
    setOwnMethod(settings.ownDeliveryMethod ?? null);
    setOwnRecipient(settings.ownRecipientEmail ?? null);
    setOwnSubject(settings.ownEmailSubject ?? null);
    setErrors({});
  }

  function validate() {
    const next: typeof errors = {};
    // The recipient/subject fields are inert while bundles are downloaded, so
    // don't block the save on values the user currently has no way to edit.
    if (effectiveMethod === BundleDeliveryMethod.Email) {
      const trimmedRecipient = (ownRecipient ?? '').trim();
      const effectiveRecipient =
        trimmedRecipient || settings.inheritedRecipientEmail;
      if (trimmedRecipient && !isValidEmail(trimmedRecipient)) {
        next.recipient = t('errors.invalidEmail');
      } else if (!effectiveRecipient) {
        next.recipient = t('errors.recipientRequired');
      }
      if (hasUnknownSubjectPlaceholder(ownSubject ?? '')) {
        next.subject = t('errors.unknownPlaceholder');
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    try {
      await update.mutateAsync({
        // null clears the unit's own setting so it inherits again.
        deliveryMethod: ownMethod,
        recipientEmail: ownRecipient?.trim() || null,
        emailSubject: ownSubject?.trim() || null,
      });
      toast.success(t('saveSuccess'));
    } catch {
      toast.error(t('saveError'));
    }
  }

  function selectMethod(value: BundleDeliveryMethod) {
    setOwnMethod(value);
    // On Download the recipient/subject fields go inert, so drop any errors
    // that would otherwise linger under the now-disabled inputs.
    if (value === BundleDeliveryMethod.Download) {
      setErrors({});
    }
  }

  function handleInsertPlaceholder(name: string) {
    const token = `{${name}}`;
    const current = ownSubject ?? settings.inheritedEmailSubject ?? '';
    const len = current.length;
    // Append at the end when the field was never focused, and clamp possibly
    // stale offsets so a prior (longer) value can't splice out of bounds.
    const focused = subjectInputRef.current === document.activeElement;
    const start = Math.min(focused ? caretRef.current.start : len, len);
    const end = Math.min(focused ? caretRef.current.end : len, len);
    const { next, caret } = insertAtSelection(current, token, start, end);
    // Match the Input's maxLength, which setState would otherwise bypass.
    if (next.length > SUBJECT_MAX_LENGTH) return;
    setOwnSubject(next);
    setErrors((prev) => ({ ...prev, subject: undefined }));
    // Restore focus and caret after React re-render.
    requestAnimationFrame(() => {
      const el = subjectInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
      caretRef.current = { start: caret, end: caret };
    });
  }

  const emailGroupDisabled = effectiveMethod === BundleDeliveryMethod.Download;

  return (
    <div className="space-y-6">
      <FieldSet className="gap-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <FieldLegend
            variant="label"
            className="mb-0 font-semibold"
            id={ids.legend}
          >
            {t('methodLabel')}
          </FieldLegend>
          {!isRoot && (
            <InheritanceNote
              sourceKind={settings.deliveryMethodSource.kind}
              sourceName={settings.deliveryMethodSource.sourceName}
              onReset={() => setOwnMethod(null)}
            />
          )}
        </div>
        {/* Value is driven by each item's onClick (not onValueChange) so that
            clicking the already-active option still pins it as an own override
            instead of firing a deselect. */}
        <ToggleGroup
          type="single"
          value={effectiveMethod}
          aria-labelledby={ids.legend}
          variant="outline"
          disabled={!canEdit}
        >
          <ToggleGroupItem
            value={BundleDeliveryMethod.Download}
            onClick={() => selectMethod(BundleDeliveryMethod.Download)}
          >
            {t('methodDownload')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value={BundleDeliveryMethod.Email}
            onClick={() => selectMethod(BundleDeliveryMethod.Email)}
          >
            {t('methodEmail')}
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {effectiveMethod === BundleDeliveryMethod.Email
            ? t('methodEmailHint')
            : t('methodDownloadHint')}
        </p>
      </FieldSet>

      <Separator />

      {/* Under Download the email settings are inert: the fieldset disables every
          control and the wrapper dims the whole group, labels and hints included.
          The Alert stays at full opacity to explain why. */}
      <fieldset disabled={emailGroupDisabled || !canEdit} className="space-y-4">
        {emailGroupDisabled && (
          <Alert className="max-w-xl">
            <Info />
            <AlertDescription>{t('emailGroupDisabledHint')}</AlertDescription>
          </Alert>
        )}
        <div
          className={cn(
            'space-y-4 transition-opacity',
            emailGroupDisabled && 'opacity-60 [&_:disabled]:opacity-100',
          )}
        >
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Label htmlFor={ids.recipient}>{t('recipientLabel')}</Label>
              {!isRoot && (
                <InheritanceNote
                  sourceKind={settings.recipientEmailSource.kind}
                  sourceName={settings.recipientEmailSource.sourceName}
                  onReset={() => setOwnRecipient(null)}
                />
              )}
            </div>
            <Input
              id={ids.recipient}
              type="email"
              autoComplete="off"
              disabled={emailGroupDisabled}
              value={displayRecipient}
              onChange={(e) => {
                setOwnRecipient(e.target.value);
                setErrors((prev) => ({ ...prev, recipient: undefined }));
              }}
              onBlur={() => {
                const trimmed = (ownRecipient ?? '').trim();
                if (trimmed && !isValidEmail(trimmed)) {
                  setErrors((prev) => ({
                    ...prev,
                    recipient: t('errors.invalidEmail'),
                  }));
                }
              }}
              placeholder={t('recipientPlaceholder')}
              aria-invalid={!!errors.recipient}
              aria-describedby={
                errors.recipient
                  ? `${ids.recipientHint} ${ids.recipientError}`
                  : ids.recipientHint
              }
              className="max-w-xl"
            />
            {errors.recipient && (
              <p
                id={ids.recipientError}
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.recipient}
              </p>
            )}
            <p id={ids.recipientHint} className="text-sm text-muted-foreground">
              {t('recipientHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Label htmlFor={ids.subject}>{t('subjectLabel')}</Label>
              {!isRoot && (
                <InheritanceNote
                  sourceKind={settings.emailSubjectSource.kind}
                  sourceName={settings.emailSubjectSource.sourceName}
                  onReset={() => setOwnSubject(null)}
                />
              )}
            </div>
            <div className="flex items-start gap-2">
              <div className="max-w-xl flex-1 space-y-1">
                <Input
                  id={ids.subject}
                  ref={subjectInputRef}
                  disabled={emailGroupDisabled}
                  value={displaySubject}
                  maxLength={SUBJECT_MAX_LENGTH}
                  onChange={(e) => {
                    setOwnSubject(e.target.value);
                    setErrors((prev) => ({ ...prev, subject: undefined }));
                  }}
                  onSelect={(e) => {
                    const el = e.currentTarget;
                    caretRef.current = {
                      start: el.selectionStart ?? 0,
                      end: el.selectionEnd ?? 0,
                    };
                  }}
                  aria-invalid={!!errors.subject}
                  aria-describedby={
                    errors.subject ? ids.subjectError : undefined
                  }
                  className="w-full"
                />
                {errors.subject && (
                  <p
                    id={ids.subjectError}
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.subject}
                  </p>
                )}
                <p className="text-right text-xs text-muted-foreground tabular-nums">
                  {displaySubject.length}/{SUBJECT_MAX_LENGTH}
                </p>
              </div>
              <div className="flex gap-2">
                {BUNDLE_SUBJECT_PLACEHOLDERS.map((name) => (
                  <ActionTooltip
                    key={name}
                    label={t(`placeholder.${name}` as Parameters<typeof t>[0])}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10"
                      // Disable rather than silently no-op when the token would
                      // push the subject past its max length.
                      disabled={
                        emailGroupDisabled ||
                        displaySubject.length + name.length + 2 >
                          SUBJECT_MAX_LENGTH
                      }
                      onClick={() => handleInsertPlaceholder(name)}
                    >
                      <Plus className="size-3.5" />
                      <span className="font-mono">{`{${name}}`}</span>
                    </Button>
                  </ActionTooltip>
                ))}
              </div>
            </div>
          </div>
        </div>
      </fieldset>

      {canEdit && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={!dirty || update.isPending}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!dirty || update.isPending}
          >
            {update.isPending ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      )}

      <AlertDialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unsavedChangesTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('unsavedChangesDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('unsavedChangesStay')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} variant="destructive">
              {t('unsavedChangesLeave')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeliverySettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-64 rounded-md" />
      </div>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 max-w-xl rounded-md" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 max-w-xl rounded-md" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
