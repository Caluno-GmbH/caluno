import { EePage } from '@/edition/ee-page';

export default function MyNotePage({
  params,
}: {
  params: Promise<{ locale: string; orgUId: string }>;
}) {
  return <EePage name="my-note-page" params={params} />;
}
