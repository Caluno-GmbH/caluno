'use client';

import { type ExportTable, PermissionKey } from '@repo/data';
import { useExportTableCsv, useHasPermission } from '@repo/data/react';
import {
  Button,
  Checkbox,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
} from '@repo/ui';
import { DownloadIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { triggerUrlDownload } from '@/lib/download/trigger-url-download';
import {
  type ExportColumnOption,
  resolveSelectedColumns,
} from './export-column-option';
import { EXTENDED_USER_GROUP } from './extended-user-columns';

interface ExportButtonProps {
  tableKind: ExportTable;
  /** Static row ids. Required unless `getRowIds` is provided (server-paginated tables). */
  rowIds?: string[];
  /** Lazily resolves the full filtered row id set, e.g. for server-paginated tables. */
  getRowIds?: () => Promise<string[]>;
  columns: ExportColumnOption[];
  permission: PermissionKey;
  disabled?: boolean;
}

export function ExportButton({
  tableKind,
  rowIds,
  getRowIds,
  columns,
  permission,
  disabled,
}: ExportButtonProps) {
  const t = useTranslations('Export');
  const hasPermission = useHasPermission(permission);
  // Extended volunteer PII (the extendedUserInfo group) needs volunteer-edit
  // rights, independent of the table's base permission.
  const canExportVolunteerData = useHasPermission(PermissionKey.VolunteerEdit);
  const mutation = useExportTableCsv();
  const [resolvingIds, setResolvingIds] = useState(false);

  const defaultChecked = columns
    .filter((c) => c.optional && c.defaultOn)
    .map((c) => c.id);

  const groupIds = [
    ...new Set(columns.filter((c) => c.group).map((c) => c.group as string)),
  ];
  const defaultEnabledGroups = Object.fromEntries(
    groupIds.map((id) => [id, false]),
  );

  const [open, setOpen] = useState(false);
  const [checkedOptional, setCheckedOptional] =
    useState<string[]>(defaultChecked);
  const [includeTechnicalIds, setIncludeTechnicalIds] = useState(false);
  const [includeSubUnits, setIncludeSubUnits] = useState(false);
  const [enabledGroups, setEnabledGroups] =
    useState<Record<string, boolean>>(defaultEnabledGroups);

  if (!hasPermission) return null;

  const toggleOptional = (id: string, checked: boolean) => {
    setCheckedOptional((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setCheckedOptional(defaultChecked);
      setIncludeTechnicalIds(false);
      setIncludeSubUnits(false);
      setEnabledGroups(defaultEnabledGroups);
    }
    setOpen(next);
  };

  const handleExport = async () => {
    const resolvedColumns = resolveSelectedColumns(
      columns,
      checkedOptional,
      enabledGroups,
    );
    try {
      setResolvingIds(true);
      const ids = getRowIds ? await getRowIds() : (rowIds ?? []);
      if (ids.length === 0) {
        toast(t('nothingToExport'));
        return;
      }
      const result = await mutation.mutateAsync({
        tableKind,
        rowIds: ids,
        columns: resolvedColumns,
        includeTechnicalIds,
        includeSubUnits,
      });
      triggerUrlDownload(result.filename, result.downloadUrl);
      setOpen(false);
    } catch {
      toast.error(t('exportFailed'));
    } finally {
      setResolvingIds(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <DownloadIcon className="size-4" />
          {t('button')}
        </Button>
      </DialogTrigger>
      <DialogContent className="data-[size=default]:sm:max-w-[45vw]">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="-m-1 max-h-[55vh] overflow-y-auto p-1">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {columns
              .filter((col) => !col.group)
              .map((col) => (
                <ColumnCheckbox
                  key={col.id}
                  id={`export-col-${col.id}`}
                  label={col.label}
                  description={col.description}
                  checked={!col.optional || checkedOptional.includes(col.id)}
                  disabled={!col.optional}
                  onCheckedChange={(checked) =>
                    col.optional && toggleOptional(col.id, checked)
                  }
                />
              ))}

            <ColumnCheckbox
              id="export-col-technical-ids"
              label={t('includeTechnicalIds')}
              description={t('includeTechnicalIdsDescription')}
              checked={includeTechnicalIds}
              onCheckedChange={setIncludeTechnicalIds}
            />

            <ColumnCheckbox
              id="export-col-include-subunits"
              label={t('includeSubUnits')}
              description={t('includeSubUnitsDescription')}
              checked={includeSubUnits}
              onCheckedChange={setIncludeSubUnits}
            />
          </div>

          {groupIds.map((groupId) => {
            const groupLocked =
              groupId === EXTENDED_USER_GROUP && !canExportVolunteerData;
            return (
              <div key={groupId} className="mt-4 rounded-md border p-3">
                <ColumnCheckbox
                  id={`export-group-${groupId}`}
                  label={t(`group.${groupId}`)}
                  description={t(`group.${groupId}Description`)}
                  checked={!groupLocked && (enabledGroups[groupId] ?? false)}
                  disabled={groupLocked}
                  onCheckedChange={(checked) =>
                    setEnabledGroups((prev) => ({
                      ...prev,
                      [groupId]: checked,
                    }))
                  }
                />
                {groupLocked ? (
                  <p className="text-muted-foreground mt-3 text-center text-sm">
                    {t('missingVolunteerDataPermission')}
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 pl-7 sm:grid-cols-2">
                    {columns
                      .filter((col) => col.group === groupId)
                      .map((col) => (
                        <ColumnCheckbox
                          key={col.id}
                          id={`export-col-${col.id}`}
                          label={col.label}
                          description={col.description}
                          checked={
                            Boolean(enabledGroups[groupId]) &&
                            checkedOptional.includes(col.id)
                          }
                          disabled={!enabledGroups[groupId]}
                          onCheckedChange={(checked) =>
                            col.optional && toggleOptional(col.id, checked)
                          }
                        />
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleExport}
            disabled={mutation.isPending || resolvingIds}
          >
            {t('exportAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ColumnCheckboxProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function ColumnCheckbox({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: ColumnCheckboxProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={descriptionId}
        className="mt-0.5"
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      <div className={cn('grid gap-0.5', disabled && 'opacity-50')}>
        <Label htmlFor={id} className="text-sm font-normal leading-snug">
          {label}
        </Label>
        {description ? (
          <p
            id={descriptionId}
            className="text-muted-foreground text-xs leading-snug"
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
