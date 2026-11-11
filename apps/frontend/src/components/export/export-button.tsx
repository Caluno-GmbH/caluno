'use client';

import type { ExportTable, PermissionKey } from '@repo/data';
import { useExportTableCsv, useHasPermission } from '@repo/data/react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Switch,
} from '@repo/ui';
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
  rowIds: string[];
  columns: ExportColumnOption[];
  permission: PermissionKey;
  disabled?: boolean;
}

export function ExportButton({
  tableKind,
  rowIds,
  columns,
  permission,
  disabled,
}: ExportButtonProps) {
  const t = useTranslations('Export');
  const hasPermission = useHasPermission(permission);
  const mutation = useExportTableCsv();

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
      const result = await mutation.mutateAsync({
        tableKind,
        rowIds,
        columns: resolvedColumns,
        includeTechnicalIds,
      });
      triggerDownload(result.filename, result.content);
      setOpen(false);
    } catch {
      toast.error(t('exportFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {t('button')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {columns.map((col) => {
            const checkboxId = `export-col-${col.id}`;
            const isChecked = !col.optional || checkedOptional.includes(col.id);
            return (
              <div key={col.id} className="flex items-center gap-2">
                <Checkbox
                  id={checkboxId}
                  checked={isChecked}
                  disabled={!col.optional}
                  onCheckedChange={(checked) =>
                    col.optional && toggleOptional(col.id, checked === true)
                  }
                />
                <Label htmlFor={checkboxId} className="text-sm font-normal">
                  {col.label}
                </Label>
              </div>
            );
          })}

          <div className="flex items-center gap-2 pt-2">
            <Switch
              id="export-include-ids"
              checked={includeTechnicalIds}
              onCheckedChange={setIncludeTechnicalIds}
            />
            <Label htmlFor="export-include-ids" className="text-sm font-normal">
              {t('includeTechnicalIds')}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleExport} disabled={mutation.isPending}>
            {t('exportAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
