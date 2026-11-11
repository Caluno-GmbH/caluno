import { EePage, eePageMetadata } from '@/edition/enterprise-page';

export const generateMetadata = eePageMetadata({
  ee: 'todo-section-page',
});

export default function OverviewSectionPage({
  params,
}: {
  params: Promise<{ orgUId: string; locale: string; section: string }>;
}) {
  return <EePage ee="todo-section-page" params={params} />;
}
