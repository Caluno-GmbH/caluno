import { EePage } from '@/edition/enterprise-page';

export default function MyNotePage({
  params,
}: {
  params: Promise<{ locale: string; orgUId: string }>;
}) {
  return <EePage name="my-note-page" params={params} />;
}
