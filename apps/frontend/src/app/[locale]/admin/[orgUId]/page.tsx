import { EePage, eePageMetadata } from '@/edition/enterprise-page';

interface AdminHomePageProps {
  params: Promise<{ orgUId: string; locale: string }>;
}

export const generateMetadata = eePageMetadata({
  ee: 'todo-page',
  fallback: 'oss-welcome-page',
});

export default function AdminHomePage({ params }: AdminHomePageProps) {
  return <EePage ee="todo-page" fallback="oss-welcome-page" params={params} />;
}
