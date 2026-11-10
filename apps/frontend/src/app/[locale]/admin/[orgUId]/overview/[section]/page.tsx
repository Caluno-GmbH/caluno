import { EePage } from '@/edition/enterprise-page';

export default function OverviewSectionPage({
  params,
}: {
  params: Promise<{ orgUId: string; locale: string; section: string }>;
}) {
  return <EePage ee="todo-section-page" params={params} />;
}
