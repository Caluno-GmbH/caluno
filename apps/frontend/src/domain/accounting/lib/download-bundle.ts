import { API_URL } from '@/lib/constants';

export function buildBundleDownloadUrl(args: {
  volunteerId: string;
  reimbursementTypeKey: string;
  invoiceIds: string[];
}): string {
  return (
    `${API_URL}/accounting/reimbursement-bundle/download` +
    `?volunteerId=${encodeURIComponent(args.volunteerId)}` +
    `&reimbursementTypeKey=${encodeURIComponent(args.reimbursementTypeKey)}` +
    `&invoiceIds=${encodeURIComponent(args.invoiceIds.join(','))}`
  );
}

export async function requestBundleDownload(args: {
  volunteerId: string;
  reimbursementTypeKey: string;
  invoiceIds: string[];
  orgUId: string;
}): Promise<Blob> {
  const url = buildBundleDownloadUrl(args);
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'x-organization-unit-id': args.orgUId },
  });
  if (!response.ok) {
    throw response;
  }
  return response.blob();
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
