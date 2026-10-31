'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Field, FieldLabel, Input } from '@repo/ui';
import { Loader2, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Controller, type Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { updateUserProfile } from '@/domain/requirement-form/actions';
import {
  buildFieldSchema,
  FieldRenderer,
  type RenderableField,
  useValidationMessages,
} from '@/domain/requirement-form/components/field-renderer';
import { PROFILE_FIELDS } from '@/domain/requirement-form/profile-fields';
import type { ProfileShape } from '@/domain/user/lib/profile-field-values';
import { useRouter } from '@/i18n/navigation';

type EditIdentityFormProps = {
  profile: ProfileShape | null | undefined;
};

const editableFields = PROFILE_FIELDS.filter((f) => f.key !== 'email');

const fieldToRenderable = (
  f: (typeof PROFILE_FIELDS)[number],
  label: string,
  subtitle: string | undefined,
): RenderableField => ({
  id: f.key,
  profileKey: f.key,
  type: f.type,
  label,
  required: f.key === 'firstname' || f.key === 'lastname',
  description: subtitle ?? null,
  placeholder: null,
  options: null,
  documents: [],
  documentLabel: null,
  minAge: null,
});

const EditIdentityForm = ({ profile }: EditIdentityFormProps) => {
  const tFields = useTranslations('RequirementForm.fieldForm');
  const tSubtitles = useTranslations('Profile.identity.subtitles');
  const tProfile = useTranslations('Profile');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const messages = useValidationMessages();

  const subtitleByKey = useMemo<Record<string, string>>(
    () => ({
      preferredName: tSubtitles('preferredName'),
      firstname: tSubtitles('firstName'),
      lastname: tSubtitles('lastName'),
      iban: tSubtitles('iban'),
      accountHolder: tSubtitles('accountHolder'),
      bic: tSubtitles('bic'),
    }),
    [tSubtitles],
  );

  const defaultValues = useMemo(() => {
    const vals: Record<string, string> = {};
    for (const f of editableFields) {
      const v = profile?.[f.key as keyof ProfileShape];
      vals[f.key] = typeof v === 'string' ? v : '';
    }
    return vals;
  }, [profile]);

  const schema = useMemo(
    () =>
      z.object(
        Object.fromEntries(
          editableFields.map((f) => [
            f.key,
            buildFieldSchema(
              fieldToRenderable(f, tFields(f.labelKey), subtitleByKey[f.key]),
              f.key === 'firstname' || f.key === 'lastname',
              messages,
            ),
          ]),
        ),
      ),
    [messages, tFields, subtitleByKey],
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isValid, isSubmitting },
  } = useForm<Record<string, string>>({
    // raw: true keeps empty optional fields as '' in form state. Without it,
    // zod preprocess (e.g. gender '' → undefined) rewrites values after the
    // first validation and desyncs dirty tracking from what the inputs show.
    resolver: zodResolver(schema, undefined, {
      raw: true,
    }) as Resolver<Record<string, string>>,
    defaultValues,
    mode: 'onChange',
  });

  const onSave = async (values: Record<string, string>) => {
    try {
      const res = await updateUserProfile({ data: values });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success(tProfile('saved'));
      router.replace('/profile');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : tProfile('saveFailed'),
      );
    }
  };

  const emailValue = typeof profile?.email === 'string' ? profile.email : '';

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-6">
      <div className="space-y-4 rounded-lg border bg-card p-6">
        {PROFILE_FIELDS.map((f) => {
          if (f.key === 'email') {
            return (
              <Field key="email">
                <FieldLabel htmlFor="email-locked">
                  {tFields('email')}
                </FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    id="email-locked"
                    value={emailValue}
                    readOnly
                    disabled
                    className="flex-1"
                  />
                  <Lock
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {tProfile('emailLocked')}
                </p>
              </Field>
            );
          }
          return (
            <Controller
              key={f.key}
              name={f.key}
              control={control}
              defaultValue=""
              render={({ field: ctrl }) => (
                <FieldRenderer
                  field={fieldToRenderable(
                    f,
                    tFields(f.labelKey),
                    subtitleByKey[f.key],
                  )}
                  value={ctrl.value ?? ''}
                  onChange={ctrl.onChange}
                  error={errors[f.key]?.message}
                />
              )}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={router.back}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={!isDirty || !isValid || isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {/* Wrapped in a span so browser translation (which replaces bare text
              nodes with <font> elements) can't break React inserting the spinner. */}
          <span>{isSubmitting ? tCommon('saving') : tCommon('save')}</span>
        </Button>
      </div>
    </form>
  );
};

export default EditIdentityForm;
