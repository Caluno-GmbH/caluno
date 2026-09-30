import { getTranslations } from 'next-intl/server';
import { isGenderOptionValue } from '@/domain/requirement-form/gender-options';
import { SYSTEM_PROFILE_FIELDS } from '@/domain/requirement-form/system-profile-fields';
import { toProfileDataMap } from '@/domain/user/lib/profile-data-map';
import { getFormatting } from '@/lib/formatting/formatting-server';
import { ProfileField } from './profile-field';

type PersonalInformationSectionProps = {
  profile: {
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
  } | null;
};

type FieldItem = {
  label: string;
  value: string | null;
  subtitle?: string;
};

export const PersonalInformationSection = async ({
  profile,
}: PersonalInformationSectionProps) => {
  const tFields = await getTranslations('RequirementForm.fieldForm');
  const tSubtitles = await getTranslations('Profile.identity.subtitles');
  const tGender = await getTranslations('RequirementForm.genderOptions');
  const { formatDate } = await getFormatting();

  const data = toProfileDataMap(profile);
  const profileValue = (key: string): string | null => {
    const value = data[key];
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  };

  let formattedBirthDate: string | null = null;
  const birthDate = profileValue('birthdate');
  if (birthDate) {
    const parsed = new Date(birthDate);
    if (!Number.isNaN(parsed.getTime())) {
      formattedBirthDate = formatDate(parsed);
    }
  }

  const subtitleByKey: Record<string, string> = {
    'preferred-name': tSubtitles('preferredName'),
    firstname: tSubtitles('firstName'),
    lastname: tSubtitles('lastName'),
    iban: tSubtitles('iban'),
    'account-holder': tSubtitles('accountHolder'),
  };

  const genderLabel = (value: string | null): string | null =>
    value && isGenderOptionValue(value) ? tGender(value) : value;

  const fields: FieldItem[] = SYSTEM_PROFILE_FIELDS.map((field) => {
    let value: string | null;
    if (field.key === 'birthdate') {
      value = formattedBirthDate;
    } else if (field.key === 'gender') {
      value = genderLabel(profileValue(field.key));
    } else {
      value = profileValue(field.key);
    }
    return {
      label: tFields(field.labelKey),
      value,
      subtitle: subtitleByKey[field.key],
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
