import {
  AdminWelcomePage,
  generateMetadata as adminWelcomeGenerateMetadata,
} from '@/domain/admin-welcome/admin-welcome-page';
import { EePage, eePageMetadata } from '@/edition/enterprise-page';

interface AdminHomePageProps {
  params: Promise<{ orgUId: string; locale: string }>;
}

export const generateMetadata = eePageMetadata({
  ee: 'todo-page',
  fallback: adminWelcomeGenerateMetadata,
});

export default function AdminHomePage({ params }: AdminHomePageProps) {
  return <EePage ee="todo-page" fallback={AdminWelcomePage} params={params} />;
}
