'use client';

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
import { type LucideIcon, Mail, Megaphone, UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';
import { toast } from 'sonner';
import { SettingsSection } from './settings-section';

// Design prototype (VOLI-1368): the org unit has no automation fields yet, so
// state lives here and saving is simulated. Backend + @repo/data wiring is a
// dev subtask named in the design brief.

export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const STEP_IN_HOURS = [12, 24, 48, 72] as const;
export type StepInHours = (typeof STEP_IN_HOURS)[number];

interface StaffingAutomation {
  enabled: boolean;
  days: Weekday[];
  stepInHours: StepInHours;
}

interface DiscoveryAutomation {
  enabled: boolean;
  days: Weekday[];
  time: string;
}

export interface AutomationsSettings {
  callOut: StaffingAutomation;
  approval: StaffingAutomation;
  discovery: DiscoveryAutomation;
}

const DEFAULT_SETTINGS: AutomationsSettings = {
  callOut: { enabled: false, days: ['SA', 'SU'], stepInHours: 48 },
  approval: { enabled: false, days: ['SA', 'SU'], stepInHours: 48 },
  discovery: { enabled: false, days: ['SU'], time: '08:00' },
};

async function saveSettings(_settings: AutomationsSettings): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300));
}

interface AutomationsSettingsProps {
  initialSettings?: AutomationsSettings;
  canEdit: boolean;
}

export function AutomationsSettings({
  initialSettings = DEFAULT_SETTINGS,
  canEdit,
}: AutomationsSettingsProps) {
  const t = useTranslations('Automations');
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);

  const update = async <K extends keyof AutomationsSettings>(
    key: K,
    patch: Partial<AutomationsSettings[K]>,
  ) => {
    const previous = settings;
    const merged = { ...settings[key], ...patch };
    // Days and the switch move together: clearing every day switches the
    // automation off, and switching it on with no days restores the defaults.
    if (patch.days?.length === 0) merged.enabled = false;
    if (patch.enabled && merged.days.length === 0) {
      merged.days = DEFAULT_SETTINGS[key].days;
    }
    const next = { ...settings, [key]: merged };
    setSettings(next);
    setIsSaving(true);
    try {
      await saveSettings(next);
    } catch {
      setSettings(previous);
      toast.error(t('updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  const staffingCard = (key: 'callOut' | 'approval', icon: LucideIcon) => {
    const automation = settings[key];
    return (
      <AutomationCard
        icon={icon}
        title={t(`${key}.title`)}
        description={t(`${key}.description`)}
        enabled={automation.enabled}
        switchDisabled={!canEdit || isSaving}
        onEnabledChange={(enabled) => update(key, { enabled })}
      >
        <WeekdayField
          label={t('days.label')}
          description={t(`${key}.daysDescription`)}
          value={automation.enabled ? automation.days : []}
          disabled={!canEdit || !automation.enabled}
          onChange={(days) => update(key, { days })}
        />
        <StepInField
          value={automation.enabled ? automation.stepInHours : null}
          disabled={!canEdit || !automation.enabled}
          onChange={(stepInHours) => update(key, { stepInHours })}
        />
      </AutomationCard>
    );
  };

  return (
    <>
      <SettingsSection
        title={t('sections.staffing.title')}
        description={t('sections.staffing.description')}
      >
        {staffingCard('callOut', Megaphone)}
        <AutomationCard
          icon={Mail}
          title={t('discovery.title')}
          description={t('discovery.description')}
          enabled={settings.discovery.enabled}
          switchDisabled={!canEdit || isSaving}
          onEnabledChange={(enabled) => update('discovery', { enabled })}
        >
          <WeekdayField
            label={t('discovery.sendOn.label')}
            description={t('discovery.sendOn.description')}
            value={settings.discovery.enabled ? settings.discovery.days : []}
            disabled={!canEdit || !settings.discovery.enabled}
            onChange={(days) => update('discovery', { days })}
          />
          <TimeField
            value={settings.discovery.enabled ? settings.discovery.time : ''}
            disabled={!canEdit || !settings.discovery.enabled}
            onChange={(time) => update('discovery', { time })}
          />
        </AutomationCard>
      </SettingsSection>
      <SettingsSection
        title={t('sections.moderation.title')}
        description={t('sections.moderation.description')}
      >
        {staffingCard('approval', UserCheck)}
      </SettingsSection>
    </>
  );
}

interface AutomationCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  switchDisabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children: ReactNode;
}

function AutomationCard({
  icon: Icon,
  title,
  description,
  enabled,
  switchDisabled,
  onEnabledChange,
  children,
}: AutomationCardProps) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Card>
      <CardContent className="@container/automation space-y-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-1 gap-2">
            <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p id={titleId} className="font-medium">
                {title}
              </p>
              <p id={descriptionId} className="text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            disabled={switchDisabled}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onCheckedChange={onEnabledChange}
          />
        </div>

        <Separator />
        {/* Always shown so admins see what they can tune before switching
            on; inactive and showing no selection until the automation is on
            (the stored choice returns when it is). One fade for the whole
            block: the controls' own disabled fade would stack on top of it. */}
        <div
          aria-disabled={!enabled}
          className={cn(
            'space-y-4 transition-opacity',
            !enabled && 'opacity-60 [&_:disabled]:opacity-100',
          )}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

// Legend → helper 4, helper → control 8 (DESIGN.md
// Proximity Spacing Scale). FieldSet and FieldLegend carry off-scale defaults,
// so both are reset here.
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
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: Weekday[];
  disabled: boolean;
  onChange: (days: Weekday[]) => void;
}) {
  const t = useTranslations('Automations');
  return (
    <SettingField label={label} description={description} disabled={disabled}>
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

function StepInField({
  value,
  disabled,
  onChange,
}: {
  value: StepInHours | null;
  disabled: boolean;
  onChange: (hours: StepInHours) => void;
}) {
  const t = useTranslations('Automations');
  const idPrefix = useId();
  return (
    <SettingField
      label={t('stepIn.label')}
      description={t('stepIn.description')}
      disabled={disabled}
    >
      {({ legendId, descriptionId }) => (
        <RadioGroup
          value={value === null ? '' : String(value)}
          onValueChange={(next) => onChange(Number(next) as StepInHours)}
          disabled={disabled}
          aria-labelledby={legendId}
          aria-describedby={descriptionId}
          className="grid grid-cols-2 gap-2 @2xl/automation:grid-cols-4"
        >
          {STEP_IN_HOURS.map((hours) => (
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

function TimeField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (time: string) => void;
}) {
  const t = useTranslations('Automations');
  return (
    <SettingField
      label={t('discovery.time.label')}
      description={t('discovery.time.description')}
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
