'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type MissingProfileKey, toMissingProfileKeys } from '@repo/data';
import {
  useContract,
  useInvoice,
  useMyDocuments,
  useUpdateMyProfile,
} from '@repo/data/react';
import {
  Button,
  cn,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  useIsMobile,
} from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Controller, type Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormSheet, useFormSheet } from '@/components/form-sheet';
import {
  buildFieldSchema,
  FieldRenderer,
  useValidationMessages,
} from '@/domain/requirement-form/components/field-renderer';
import { profileDataToUpdateInput } from '@/domain/user/lib/profile-data-map';
import { useRouter } from '@/i18n/navigation';
import {
  completeProfileDefaultValues,
  missingFieldsToRenderable,
} from '../lib/complete-profile-fields';
import type { VolunteerDocumentKind } from '../lib/volunteer-documents.utils';

interface CompleteProfileSheetProps {
  kind: VolunteerDocumentKind | null;
  documentId: string | null;
  userNames: { firstname: string | null; lastname: string | null };
}

/**
 * Sheet over "My documents" that collects exactly the profile details one
 * document is missing. Bad URLs, load failures and the already-complete case
 * render a message state instead of the form; saving writes the volunteer's
 * profile and returns to the refreshed documents list.
 */
export function CompleteProfileSheet({
  kind,
  documentId,
  userNames,
}: CompleteProfileSheetProps) {
  const t = useTranslations('MyDocuments.completeProfile');
  const tNames = useTranslations('MembershipDetail.documents.names');
  const router = useRouter();
  const { open, setOpen } = useFormSheet();

  // Always return to the list — a hard load of the sheet URL has no back entry.
  const close = () =>
    setOpen(false, () => router.replace('/profile/documents'));

  const contractQuery = useContract(
    kind === 'contract' ? (documentId ?? undefined) : undefined,
  );
  const invoiceQuery = useInvoice(
    kind === 'invoice' ? (documentId ?? undefined) : undefined,
  );
  const query = kind === 'contract' ? contractQuery : invoiceQuery;

  // The detail queries carry no org name; the (usually cached) documents list
  // does, so the description can name the org the document belongs to.
  const myDocumentsQuery = useMyDocuments();
  const orgName = useMemo(() => {
    if (!documentId) return null;
    for (const group of myDocumentsQuery.data ?? []) {
      if (
        group.contracts.some((c) => c.id === documentId) ||
        group.invoices.some((i) => i.id === documentId)
      ) {
        return group.organizationName;
      }
    }
    return null;
  }, [myDocumentsQuery.data, documentId]);

  const missingKeys = useMemo(
    () => toMissingProfileKeys(query.data?.missingProfileFields ?? []),
    [query.data],
  );

  // Latch the keys the form first rendered with. Saving invalidates this
  // document's query; the refetch reports nothing missing while the sheet is
  // still sliding out, and without the latch the form would swap for the
  // "all complete" message mid-close.
  const [formKeys, setFormKeys] = useState<MissingProfileKey[] | null>(null);
  if (formKeys === null && missingKeys.length > 0) {
    setFormKeys(missingKeys);
  }

  const documentName = kind
    ? tNames(kind === 'contract' ? 'agreement' : 'timesheet')
    : '';
  const description = orgName
    ? `${t('description', { documentName, orgName })} ${t('savedToProfile')}`
    : `${t('descriptionWithoutOrg', { documentName })} ${t('savedToProfile')}`;

  if (kind === null || documentId === null || query.isError) {
    return (
      <MessageSheet
        open={open}
        onClose={close}
        title={t('title')}
        message={t('error')}
        closeLabel={t('close')}
      />
    );
  }

  if (query.isLoading || !query.data) {
    return (
      <FormSheet
        title={t('title')}
        description={description}
        onSubmit={() => {}}
        open={open}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        submitDisabled
      >
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </FormSheet>
    );
  }

  if (formKeys === null) {
    return (
      <MessageSheet
        open={open}
        onClose={close}
        title={t('title')}
        message={t('allComplete')}
        closeLabel={t('close')}
      />
    );
  }

  return (
    <CompleteProfileForm
      key={documentId}
      missingKeys={formKeys}
      userNames={userNames}
      title={t('title')}
      description={description}
      open={open}
      onClose={close}
    />
  );
}

/** Error / nothing-missing states: a message and a Close button, no form. */
function MessageSheet({
  open,
  onClose,
  title,
  message,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  closeLabel: string;
}) {
  const isMobile = useIsMobile();
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex h-full w-full flex-col gap-0 overflow-hidden md:max-w-xl',
          isMobile && 'max-h-[calc(100vh-1.5rem)] rounded-t-2xl',
        )}
      >
        <SheetHeader className="shrink-0 px-6 pt-6">
          <SheetTitle className="text-2xl font-bold">{title}</SheetTitle>
          <SheetDescription>{message}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="mt-auto flex shrink-0 flex-row">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {closeLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CompleteProfileForm({
  missingKeys,
  userNames,
  title,
  description,
  open,
  onClose,
}: {
  missingKeys: MissingProfileKey[];
  userNames: { firstname: string | null; lastname: string | null };
  title: string;
  description: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('MyDocuments.completeProfile');
  const tFields = useTranslations('RequirementForm.fieldForm');
  const messages = useValidationMessages();
  const updateProfile = useUpdateMyProfile();

  const fields = useMemo(
    () => missingFieldsToRenderable(missingKeys, tFields),
    [missingKeys, tFields],
  );

  const schema = useMemo(
    () =>
      z.object(
        Object.fromEntries(
          fields.map((f) => [f.id, buildFieldSchema(f, true, messages)]),
        ),
      ),
    [fields, messages],
  );

  const defaultValues = useMemo(
    () => completeProfileDefaultValues(missingKeys, userNames),
    [missingKeys, userNames],
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema) as Resolver<Record<string, string>>,
    defaultValues,
    mode: 'onChange',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateProfile.mutateAsync(profileDataToUpdateInput(values));
      toast.success(t('success'));
      onClose();
    } catch {
      // Never render the server message — it can carry internal ids. Generic
      // copy, sheet stays open with the values intact.
      toast.error(t('saveError'));
    }
  });

  return (
    <FormSheet
      title={title}
      description={description}
      onSubmit={onSubmit}
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      pending={updateProfile.isPending}
      submitDisabled={!isValid}
    >
      {fields.map((f) => (
        <Controller
          key={f.id}
          name={f.id}
          control={control}
          render={({ field: ctrl }) => (
            <FieldRenderer
              field={f}
              value={ctrl.value ?? ''}
              onChange={ctrl.onChange}
              error={errors[f.id]?.message}
            />
          )}
        />
      ))}
    </FormSheet>
  );
}
