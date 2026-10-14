import { CompleteProfileSheet } from '@/domain/accounting/components/complete-profile-sheet';

interface CompleteProfileSheetPageProps {
  searchParams: Promise<{ kind?: string; id?: string }>;
}

/**
 * Sheet route: complete the profile details one document is missing. Bad
 * `kind`/`id` values are forwarded as null — the sheet renders its own error
 * state rather than a 404. The current user's names come along for the
 * accountHolder prefill.
 */
export default async function CompleteProfileSheetPage({
  searchParams,
}: CompleteProfileSheetPageProps) {
  const { kind, id } = await searchParams;

  return (
    <CompleteProfileSheet
      key={`${kind}-${id}`}
      kind={kind === 'contract' || kind === 'invoice' ? kind : null}
      documentId={id ?? null}
    />
  );
}
