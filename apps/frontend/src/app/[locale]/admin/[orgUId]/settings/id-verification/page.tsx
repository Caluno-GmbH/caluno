import { redirect } from '@/i18n/navigation';

interface IdVerificationSettingsPageProps {
  params: Promise<{ orgUId: string; locale: string }>;
}

// ID verification moved to the shift settings page (VOLI-1368); keep old links
// working.
export default async function IdVerificationSettingsPage({
  params,
}: IdVerificationSettingsPageProps) {
  const { orgUId, locale } = await params;
  redirect({ href: `/admin/${orgUId}/settings/shifts`, locale });
}
