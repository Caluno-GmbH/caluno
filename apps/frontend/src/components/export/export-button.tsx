'use client';

import type { ExportTable, PermissionKey } from '@repo/data';
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
import { triggerDownload } from '@/lib/download/trigger-download';
import {
  type ExportColumnOption,
  resolveSelectedColumns,
} from './export-column-option';

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
  const mutation = useExportTableCsv();
  const [resolvingIds, setResolvingIds] = useState(false);

  const defaultChecked = columns
    .filter((c) => c.optional && c.defaultOn)
    .map((c) => c.id);

  const [open, setOpen] = useState(false);
  const [checkedOptional, setCheckedOptional] =
    useState<string[]>(defaultChecked);
  const [includeTechnicalIds, setIncludeTechnicalIds] = useState(false);

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
    }
    setOpen(next);
  };

  const handleExport = async () => {
    const resolvedColumns = resolveSelectedColumns(columns, [
      ...columns.filter((c) => !c.optional).map((c) => c.id),
      ...checkedOptional,
    ]);
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
      });
      triggerDownload(result.filename, result.content);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="-m-1 max-h-[55vh] overflow-y-auto p-1">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {columns.map((col) => (
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
          </div>
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
