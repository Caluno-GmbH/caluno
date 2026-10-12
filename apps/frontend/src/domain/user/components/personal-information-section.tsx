import { getTranslations } from 'next-intl/server';
import { isGenderOptionValue } from '@/domain/requirement-form/gender-options';
import { SYSTEM_PROFILE_FIELDS } from '@/domain/requirement-form/system-profile-fields';
import { getFormatting } from '@/lib/formatting/formatting-server';
import { ProfileField } from './profile-field';

type ProfileShape = {
  firstname?: string | null;
  lastname?: string | null;
  preferredName?: string | null;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  birthdate?: string | null;
  iban?: string | null;
  accountHolder?: string | null;
  bic?: string | null;
};

type PersonalInformationSectionProps = {
  profile: ProfileShape | null;
};

type FieldItem = {
  label: string;
  value: string | null;
  subtitle?: string;
};

const profileValue = (
  profile: ProfileShape | null,
  key: keyof ProfileShape,
): string | null => {
  const value = profile?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

export const PersonalInformationSection = async ({
  profile,
}: PersonalInformationSectionProps) => {
  const tFields = await getTranslations('RequirementForm.fieldForm');
  const tSubtitles = await getTranslations('Profile.identity.subtitles');
  const tGender = await getTranslations('RequirementForm.genderOptions');
  const { formatDate } = await getFormatting();

  let formattedBirthDate: string | null = null;
  const birthDate = profileValue(profile, 'birthdate');
  if (birthDate) {
    const parsed = new Date(birthDate);
    if (!Number.isNaN(parsed.getTime())) {
      formattedBirthDate = formatDate(parsed);
    }
  }

  const subtitleByKey: Partial<Record<keyof ProfileShape, string>> = {
    preferredName: tSubtitles('preferredName'),
    firstname: tSubtitles('firstName'),
    lastname: tSubtitles('lastName'),
    iban: tSubtitles('iban'),
    accountHolder: tSubtitles('accountHolder'),
  };

  const genderLabel = (value: string | null): string | null =>
    value && isGenderOptionValue(value) ? tGender(value) : value;

  const fields: FieldItem[] = SYSTEM_PROFILE_FIELDS.map((field) => {
    const key = field.key as keyof ProfileShape;
    let value: string | null;
    if (field.key === 'birthdate') {
      value = formattedBirthDate;
    } else if (field.key === 'gender') {
      value = genderLabel(profileValue(profile, 'gender'));
    } else {
      value = profileValue(profile, key);
    }
    return {
      label: tFields(field.labelKey),
      value,
      subtitle: subtitleByKey[key],
    };
  });

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <ProfileField key={field.label} {...field} />
      ))}
    </div>
  );
};
