import { MyDocumentsContent } from '../my-documents-content';

/**
 * Main-slot fallback for the complete-profile sheet URL: a hard load or
 * reload of `/profile/documents/complete-profile?...` renders the documents
 * list behind the open sheet instead of a 404.
 */
export default async function CompleteProfileFallbackPage() {
  return <MyDocumentsContent />;
}
