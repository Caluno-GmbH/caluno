'use client';
import {
  AccountingRepository,
  type CreateDocumentTemplateInput,
  type DocumentKind,
  type DocumentTemplateDetail,
  type DocumentTemplateSummary,
  isNotFoundDataError,
  type UpdateDocumentTemplateInput,
} from '@repo/data';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';

export function useDocumentTemplates() {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);

  return useQuery<DocumentTemplateSummary[]>({
    queryKey: ['accounting', 'document-templates'],
    queryFn: () => repository.findDocumentTemplates(),
    staleTime: 30 * 1000,
  });
}

export function useDocumentTemplate(id?: string) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);

  return useQuery<DocumentTemplateDetail>({
    queryKey: ['accounting', 'document-template', id],
    queryFn: () => repository.findDocumentTemplateById(id ?? ''),
    staleTime: 30 * 1000,
    enabled: !!id,
  });
}

export function useActiveDocumentTemplate(
  kind?: DocumentKind,
  reimbursementTypeId?: string,
  organizationUnitId?: string,
) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);

  return useQuery<DocumentTemplateDetail>({
    queryKey: [
      'accounting',
      'active-document-template',
      kind,
      reimbursementTypeId,
      organizationUnitId,
    ],
    queryFn: () =>
      repository.findActiveDocumentTemplate({
        kind: kind as DocumentKind,
        reimbursementTypeId: reimbursementTypeId ?? '',
        organizationUnitId,
      }),
    staleTime: 30 * 1000,
    enabled: !!kind && !!reimbursementTypeId,
  });
}

export interface TemplateSlotRef {
  kind: DocumentKind;
  reimbursementTypeId?: string;
}

/**
 * An unset slot is a NotFound on the backend, which is a normal state here, so
 * it maps to null. Any other failure is a real error and is rethrown.
 */
export async function nullIfNotFound<T>(
  load: () => Promise<T>,
): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (isNotFoundDataError(error)) return null;
    throw error;
  }
}

function resolvedTemplateQuery(
  repository: AccountingRepository,
  slot: TemplateSlotRef,
  organizationUnitId: string,
) {
  return {
    queryKey: [
      'accounting',
      'resolved-document-template',
      slot.kind,
      slot.reimbursementTypeId,
      organizationUnitId,
    ],
    // The backend walks own unit, ancestors, then org-wide.
    queryFn: (): Promise<DocumentTemplateDetail | null> =>
      nullIfNotFound(() =>
        repository.findActiveDocumentTemplate({
          kind: slot.kind,
          reimbursementTypeId: slot.reimbursementTypeId ?? '',
          organizationUnitId,
        }),
      ),
    staleTime: 30 * 1000,
    enabled: !!slot.reimbursementTypeId,
  };
}

/**
 * The template a slot actually resolves to at an org unit, or null when the
 * slot is not set up. Resolution happens on the backend (unit chain, then
 * org-wide), so this is the single source of truth for "which template applies".
 */
export function useResolvedDocumentTemplate(
  slot: TemplateSlotRef,
  organizationUnitId: string,
) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);
  return useQuery(resolvedTemplateQuery(repository, slot, organizationUnitId));
}

/** Resolved templates for several slots at once, in the order given. */
export function useResolvedDocumentTemplates(
  slots: TemplateSlotRef[],
  organizationUnitId: string,
) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);
  return useQueries({
    queries: slots.map((slot) =>
      resolvedTemplateQuery(repository, slot, organizationUnitId),
    ),
  });
}

function invalidateTemplateQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({
    queryKey: ['accounting', 'document-templates'],
  });
  queryClient.invalidateQueries({
    queryKey: ['accounting', 'resolved-document-template'],
  });
  queryClient.invalidateQueries({
    queryKey: ['accounting', 'active-document-template'],
  });
  queryClient.invalidateQueries({
    queryKey: ['accounting', 'setup-status'],
  });
}

export function useCreateDocumentTemplate() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new AccountingRepository(sdk);

  return useMutation({
    mutationFn: (input: CreateDocumentTemplateInput) =>
      repository.createDocumentTemplate(input),
    onSuccess: () => {
      invalidateTemplateQueries(queryClient);
    },
  });
}

export function useUpdateDocumentTemplate() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new AccountingRepository(sdk);

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateDocumentTemplateInput;
    }) => repository.updateDocumentTemplate(id, input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'document-template', result.id],
      });
      invalidateTemplateQueries(queryClient);
    },
  });
}

export function useDeleteDocumentTemplate() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new AccountingRepository(sdk);

  return useMutation({
    mutationFn: (id: string) => repository.deleteDocumentTemplate(id),
    onSuccess: () => {
      invalidateTemplateQueries(queryClient);
    },
  });
}
