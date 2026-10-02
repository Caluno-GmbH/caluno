'use client';

import {
  type OrganizationUnitAutomationKind,
  useUpdateOrganizationUnitAutomation,
  Weekday,
} from '@repo/data/react';
import {
  Card,
  CardContent,
  cn,
  FieldLegend,
  FieldSet,
  Input,
  RadioGroup,
  RadioGroupItem,
  Separator,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from '@repo/ui';
import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';
import { toast } from 'sonner';

export const WEEKDAYS: readonly Weekday[] = [
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
  Weekday.Saturday,
  Weekday.Sunday,
];

export const LEAD_TIME_HOURS = [12, 24, 48, 72] as const;

export interface AutomationCardSettings {
  enabled: boolean;
  activeDays: Weekday[];
  leadTimeHours?: number | null;
  sendAtTime?: string | null;
}

interface AutomationCardProps {
  organizationUnitId: string;
  kind: OrganizationUnitAutomationKind;
  copyKey: 'callOut' | 'approval' | 'discovery';
  icon: ReactNode;
  control: 'leadTime' | 'sendTime';
  initialSettings: AutomationCardSettings;
  canEdit: boolean;
}

export function AutomationCard({
  organizationUnitId,
  kind,
  copyKey,
  icon,
  control,
  initialSettings,
  canEdit,
}: AutomationCardProps) {
  const t = useTranslations('Automations');
  const [settings, setSettings] = useState(initialSettings);
  const mutation = useUpdateOrganizationUnitAutomation();
  const titleId = useId();
  const descriptionId = useId();

  const update = async (patch: Partial<AutomationCardSettings>) => {
    const previous = settings;
    setSettings({ ...settings, ...patch });

    try {
      await mutation.mutateAsync({ organizationUnitId, kind, input: patch });
    } catch {
      setSettings(previous);
      toast.error(t(`${copyKey}.updateError`));
    }
  };

  const { enabled, activeDays, leadTimeHours, sendAtTime } = settings;
  const controlsDisabled = !canEdit || !enabled;

  return (
    <Card>
      <CardContent className="@container/automation space-y-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-1 gap-2">
            <span className="mt-0.5 shrink-0 text-muted-foreground [&>svg]:size-5">
              {icon}
            </span>
            <div className="space-y-1">
              <p id={titleId} className="font-medium">
                {t(`${copyKey}.title`)}
              </p>
              <p id={descriptionId} className="text-sm text-muted-foreground">
                {t(`${copyKey}.description`)}
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            disabled={!canEdit || mutation.isPending}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onCheckedChange={(next) => update({ enabled: next })}
          />
        </div>

        <Separator />

        <div
          aria-disabled={!enabled}
          className={cn(
            'space-y-4 transition-opacity',
            !enabled && 'opacity-60 [&_:disabled]:opacity-100',
          )}
        >
          <WeekdayField
            description={t(`${copyKey}.daysDescription`)}
            value={enabled ? activeDays : []}
            disabled={controlsDisabled}
            onChange={(days) => update({ activeDays: days })}
          />
          {control === 'leadTime' ? (
            <LeadTimeField
              description={t(`${copyKey}.stepInDescription`)}
              value={enabled ? (leadTimeHours ?? null) : null}
              disabled={controlsDisabled}
              onChange={(hours) => update({ leadTimeHours: hours })}
            />
          ) : (
            <SendTimeField
              description={t(`${copyKey}.sendAtDescription`)}
              value={enabled ? (sendAtTime ?? '') : ''}
              disabled={controlsDisabled}
              onChange={(time) => update({ sendAtTime: time })}
            />
          )}
        </div>

        {enabled && activeDays.length === 0 && (
          <p
            role="status"
            className="flex items-start gap-2 text-sm text-muted-foreground"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {t(`${copyKey}.noDaysHint`)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SettingField({
  label,
  description,
  disabled,
  children,
}: {
  label: string;
  description: string;
  disabled: boolean;
  children: (ids: { legendId: string; descriptionId: string }) => ReactNode;
}) {
  const legendId = useId();
  const descriptionId = useId();
  return (
    <FieldSet
      disabled={disabled}
      className="gap-0 has-[>[data-slot=radio-group]]:gap-0"
    >
      <FieldLegend variant="label" className="mb-0" id={legendId}>
        {label}
      </FieldLegend>
      <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
        {description}
      </p>
      <div className="mt-2">{children({ legendId, descriptionId })}</div>
    </FieldSet>
  );
}

function WeekdayField({
  description,
  value,
  disabled,
  onChange,
}: {
  description: string;
  value: Weekday[];
  disabled: boolean;
  onChange: (days: Weekday[]) => void;
}) {
  const t = useTranslations('Automations');
  return (
    <SettingField
      label={t('days.label')}
      description={description}
      disabled={disabled}
    >
      {({ legendId, descriptionId }) => (
        <ToggleGroup
          type="multiple"
          variant="outline"
          spacing={2}
          value={value}
          onValueChange={(days: string[]) =>
            onChange(WEEKDAYS.filter((day) => days.includes(day)))
          }
          disabled={disabled}
          aria-labelledby={legendId}
          aria-describedby={descriptionId}
          className="flex-wrap"
        >
          {WEEKDAYS.map((day) => (
            <ToggleGroupItem
              key={day}
              value={day}
              aria-label={t(`days.long.${day}`)}
              className="h-11 min-w-12 rounded-xl px-3 text-base data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {t(`days.short.${day}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </SettingField>
  );
}

function LeadTimeField({
  description,
  value,
  disabled,
  onChange,
}: {
  description: string;
  value: number | null;
  disabled: boolean;
  onChange: (hours: number) => void;
}) {
  const t = useTranslations('Automations');
  const idPrefix = useId();
  return (
    <SettingField
      label={t('stepIn.label')}
      description={description}
      disabled={disabled}
    >
      {({ legendId, descriptionId }) => (
        <RadioGroup
          value={value === null ? '' : String(value)}
          onValueChange={(next) => onChange(Number(next))}
          disabled={disabled}
          aria-labelledby={legendId}
          aria-describedby={descriptionId}
          className="grid grid-cols-2 gap-2 @2xl/automation:grid-cols-4"
        >
          {LEAD_TIME_HOURS.map((hours) => (
            <div key={hours} className="flex items-center gap-2">
              <RadioGroupItem
                value={String(hours)}
                id={`${idPrefix}-${hours}`}
              />
              <label
                htmlFor={`${idPrefix}-${hours}`}
                className="cursor-pointer text-sm leading-tight"
              >
                {t('stepIn.option', { hours })}
              </label>
            </div>
          ))}
        </RadioGroup>
      )}
    </SettingField>
  );
}

function SendTimeField({
  description,
  value,
  disabled,
  onChange,
}: {
  description: string;
  value: string;
  disabled: boolean;
  onChange: (time: string) => void;
}) {
  const t = useTranslations('Automations');
  return (
    <SettingField
      label={t('sendAt.label')}
      description={description}
      disabled={disabled}
    >
      {({ legendId, descriptionId }) => (
        <Input
          type="time"
          className="w-36"
          value={value}
          disabled={disabled}
          aria-labelledby={legendId}
          aria-describedby={descriptionId}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value);
          }}
        />
      )}
    </SettingField>
  );
}
