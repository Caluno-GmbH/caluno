'use client';

import {
  AccountingSettingSourceKind,
  BundleDeliveryMethod,
  type RawAccountingDeliverySettings,
} from '@repo/data';
import {
  useAccountingDeliverySettings,
  useUpdateAccountingDeliverySettings,
} from '@repo/data/react';
import {
  Button,
  FieldLegend,
  FieldSet,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Separator,
  Skeleton,
} from '@repo/ui';
import { AlertCircleIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';
import { toast } from 'sonner';
import {
  BUNDLE_SUBJECT_PLACEHOLDERS,
  hasUnknownSubjectPlaceholder,
  isValidEmail,
  maskEmail,
} from '../lib/delivery-settings';

type MethodChoice = BundleDeliveryMethod | 'inherit';

const PLACEHOLDER_LIST = BUNDLE_SUBJECT_PLACEHOLDERS.map(
  (name) => `{${name}}`,
).join(', ');

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
  const [editing, setEditing] = useState(false);

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{t('sectionTitle')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('sectionSubtitle')}
          </p>
        </div>
        {canEdit && !editing && <EditButton onClick={() => setEditing(true)} />}
      </div>
      {editing ? (
        <DeliverySettingsForm
          settings={query.data}
          organizationUnitId={organizationUnitId}
          onDone={() => setEditing(false)}
        />
      ) : (
        <DeliverySettingsSummary settings={query.data} />
      )}
    </div>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  const tCommon = useTranslations('Common');
  return (
    <Button size="sm" variant="outline" type="button" onClick={onClick}>
      {tCommon('edit')}
    </Button>
  );
}

function useSourceLine() {
  const t = useTranslations('Accounting.settings.delivery');
  return (source: RawAccountingDeliverySettings['deliveryMethodSource']) => {
    switch (source.kind) {
      case AccountingSettingSourceKind.Own:
        return t('source.own');
      case AccountingSettingSourceKind.Inherited:
        return t('source.inheritedFrom', { source: source.sourceName ?? '' });
      default:
        return t('source.default');
    }
  };
}

function useMethodLabel() {
  const t = useTranslations('Accounting.settings.delivery');
  return (method: BundleDeliveryMethod) =>
    method === BundleDeliveryMethod.Email
      ? t('methodEmail')
      : t('methodDownload');
}

function SummaryRow({
  label,
  source,
  children,
}: {
  label: string;
  source: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm font-medium text-card-foreground">{label}</p>
      <div className="text-right space-y-0.5 min-w-0">
        <div className="text-sm text-card-foreground break-words">
          {children}
        </div>
        <p className="text-sm text-muted-foreground">{source}</p>
      </div>
    </div>
  );
}

function DeliverySettingsSummary({
  settings,
}: {
  settings: RawAccountingDeliverySettings;
}) {
  const t = useTranslations('Accounting.settings.delivery');
  const sourceLine = useSourceLine();
  const methodLabel = useMethodLabel();
  const [revealed, setRevealed] = useState(false);
  const recipient = settings.recipientEmail;

  return (
    <div className="space-y-4">
      <SummaryRow
        label={t('methodLabel')}
        source={sourceLine(settings.deliveryMethodSource)}
      >
        {methodLabel(settings.deliveryMethod)}
      </SummaryRow>
      <Separator />
      <SummaryRow
        label={t('recipientLabel')}
        source={sourceLine(settings.recipientEmailSource)}
      >
        {recipient ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="tabular-nums">
              {revealed ? recipient : maskEmail(recipient)}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={revealed ? t('hideRecipient') : t('showRecipient')}
              onClick={() => setRevealed((value) => !value)}
            >
              {revealed ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
            </Button>
          </span>
        ) : (
          <span className="text-muted-foreground">{t('recipientNotSet')}</span>
        )}
      </SummaryRow>
      <Separator />
      <SummaryRow
        label={t('subjectLabel')}
        source={sourceLine(settings.emailSubjectSource)}
      >
        {settings.emailSubject}
      </SummaryRow>
    </div>
  );
}

function DeliverySettingsForm({
  settings,
  organizationUnitId,
  onDone,
}: {
  settings: RawAccountingDeliverySettings;
  organizationUnitId: string;
  onDone: () => void;
}) {
  const t = useTranslations('Accounting.settings.delivery');
  const tCommon = useTranslations('Common');
  const methodLabel = useMethodLabel();
  const update = useUpdateAccountingDeliverySettings(organizationUnitId);
  const ids = {
    legend: useId(),
    method: useId(),
    recipient: useId(),
    recipientHint: useId(),
    subject: useId(),
    subjectHint: useId(),
  };

  const [method, setMethod] = useState<MethodChoice>(
    settings.ownDeliveryMethod ?? 'inherit',
  );
  const [recipient, setRecipient] = useState(settings.ownRecipientEmail ?? '');
  const [subject, setSubject] = useState(settings.ownEmailSubject ?? '');
  const [errors, setErrors] = useState<{
    recipient?: string;
    subject?: string;
  }>({});

  const effectiveMethod =
    method === 'inherit' ? settings.inheritedDeliveryMethod : method;
  const effectiveRecipient =
    recipient.trim() || settings.inheritedRecipientEmail;

  function validate() {
    const next: typeof errors = {};
    const trimmedRecipient = recipient.trim();
    if (trimmedRecipient && !isValidEmail(trimmedRecipient)) {
      next.recipient = t('errors.invalidEmail');
    } else if (
      effectiveMethod === BundleDeliveryMethod.Email &&
      !effectiveRecipient
    ) {
      next.recipient = t('errors.recipientRequired');
    }
    if (hasUnknownSubjectPlaceholder(subject)) {
      next.subject = t('errors.unknownPlaceholder');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    try {
      // Empty values clear the unit's own setting, so it inherits again.
      await update.mutateAsync({
        deliveryMethod: method === 'inherit' ? null : method,
        recipientEmail: recipient.trim() || null,
        emailSubject: subject.trim() || null,
      });
      toast.success(t('saveSuccess'));
      onDone();
    } catch {
      // The form checks what the server checks; a rejection here means the
      // inherited values changed meanwhile, so a reload shows the current state.
      toast.error(t('saveError'));
    }
  }

  return (
    <div className="space-y-6">
      <FieldSet className="gap-0">
        <FieldLegend variant="label" className="mb-2" id={ids.legend}>
          {t('methodLabel')}
        </FieldLegend>
        <RadioGroup
          value={method}
          onValueChange={(value) => setMethod(value as MethodChoice)}
          aria-labelledby={ids.legend}
          className="gap-3"
        >
          <MethodOption
            id={`${ids.method}-inherit`}
            value="inherit"
            label={t('methodInherit', {
              value: methodLabel(settings.inheritedDeliveryMethod),
            })}
          />
          <MethodOption
            id={`${ids.method}-download`}
            value={BundleDeliveryMethod.Download}
            label={t('methodDownload')}
            hint={t('methodDownloadHint')}
          />
          <MethodOption
            id={`${ids.method}-email`}
            value={BundleDeliveryMethod.Email}
            label={t('methodEmail')}
            hint={t('methodEmailHint')}
          />
        </RadioGroup>
      </FieldSet>

      <div className="space-y-1.5">
        <Label htmlFor={ids.recipient}>{t('recipientLabel')}</Label>
        <p id={ids.recipientHint} className="text-sm text-muted-foreground">
          {t('recipientHint')}
        </p>
        <Input
          id={ids.recipient}
          type="email"
          autoComplete="off"
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            setErrors((prev) => ({ ...prev, recipient: undefined }));
          }}
          placeholder={
            settings.inheritedRecipientEmail
              ? t('inheritPlaceholder', {
                  value: maskEmail(settings.inheritedRecipientEmail),
                })
              : t('recipientPlaceholder')
          }
          aria-invalid={!!errors.recipient}
          aria-describedby={ids.recipientHint}
          className="max-w-md"
        />
        {errors.recipient && (
          <p className="text-sm text-destructive" role="alert">
            {errors.recipient}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={ids.subject}>{t('subjectLabel')}</Label>
        <Input
          id={ids.subject}
          value={subject}
          maxLength={200}
          onChange={(e) => {
            setSubject(e.target.value);
            setErrors((prev) => ({ ...prev, subject: undefined }));
          }}
          placeholder={t('inheritPlaceholder', {
            value: settings.inheritedEmailSubject,
          })}
          aria-invalid={!!errors.subject}
          aria-describedby={ids.subjectHint}
        />
        <p id={ids.subjectHint} className="text-sm text-muted-foreground">
          {t('subjectHint', { placeholders: PLACEHOLDER_LIST })} ·{' '}
          {t('clearHint')}
        </p>
        {errors.subject && (
          <p className="text-sm text-destructive" role="alert">
            {errors.subject}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={handleSave} disabled={update.isPending}>
          {tCommon('save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {tCommon('cancel')}
        </Button>
      </div>
    </div>
  );
}

function MethodOption({
  id,
  value,
  label,
  hint,
}: {
  id: string;
  value: MethodChoice;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <label htmlFor={id} className="cursor-pointer text-sm leading-tight">
        <span className="font-medium text-card-foreground">{label}</span>
        {hint && (
          <span className="block mt-0.5 text-muted-foreground">{hint}</span>
        )}
      </label>
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
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}
