'use client';

import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  RadioGroup,
  RadioGroupItem,
  Switch,
} from '@repo/ui';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { updateShiftInstanceApproval } from '../actions';

type ApprovalScope = 'only-this' | 'future';

interface ShiftApprovalToggleProps {
  orgUId: string;
  instanceId: string;
  isRecurring: boolean;
  instanceDate: Date;
  joinRequiresApproval: boolean;
  disabled?: boolean;
}

export function ShiftApprovalToggle({
  orgUId,
  instanceId,
  isRecurring,
  instanceDate,
  joinRequiresApproval,
  disabled,
}: ShiftApprovalToggleProps) {
  const t = useTranslations('Shift');
  const router = useRouter();
  const { formatDate } = useFormatting();
  const switchId = useId();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState(joinRequiresApproval);
  const [scope, setScope] = useState<ApprovalScope>('only-this');

  const instanceDateFormatted = formatDate(instanceDate);

  const handleCheckedChange = (next: boolean) => {
    setPendingValue(next);
    setScope('only-this');
    setOpen(true);
  };

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await updateShiftInstanceApproval({
        instanceId,
        organizationUnitId: orgUId,
        joinRequiresApproval: pendingValue,
        applyToAllFuture: scope === 'future',
      });

      if (result?.serverError) {
        toast.error(
          t('instanceDetail.approvalDialog.error', {
            error: result.serverError,
          }),
        );
        return;
      }

      toast.success(t('instanceDetail.approvalDialog.success'));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Card className="rounded-md p-4 space-y-3">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor={switchId}>
            {t('form.approvalRequiredLabel')}
          </FieldLabel>
          <FieldDescription>
            {t('form.approvalRequiredDescription')}
          </FieldDescription>
        </FieldContent>
        <Switch
          id={switchId}
          checked={joinRequiresApproval}
          onCheckedChange={handleCheckedChange}
          disabled={disabled || pending}
        />
      </Field>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('instanceDetail.approvalDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {pendingValue
                ? t('instanceDetail.approvalDialog.turnOnDescription')
                : t('instanceDetail.approvalDialog.turnOffDescription')}
            </DialogDescription>
          </DialogHeader>

          {isRecurring && (
            <RadioGroup
              value={scope}
              onValueChange={(value) => setScope(value as ApprovalScope)}
              className="gap-2"
            >
              <label
                htmlFor="approval-only-this"
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-muted"
              >
                <RadioGroupItem
                  id="approval-only-this"
                  value="only-this"
                  className="mt-0.5"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">
                    {t('instanceDetail.approvalDialog.onlyThisTitle')}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {t('instanceDetail.approvalDialog.onlyThisDescription', {
                      date: instanceDateFormatted,
                    })}
                  </span>
                </span>
              </label>

              <label
                htmlFor="approval-future"
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-muted"
              >
                <RadioGroupItem
                  id="approval-future"
                  value="future"
                  className="mt-0.5"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">
                    {t('instanceDetail.approvalDialog.futureTitle')}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {t('instanceDetail.approvalDialog.futureDescription', {
                      date: instanceDateFormatted,
                    })}
                  </span>
                </span>
              </label>
            </RadioGroup>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {t('instanceDetail.approvalDialog.cancel')}
            </Button>
            <Button onClick={handleConfirm} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {t('instanceDetail.approvalDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
