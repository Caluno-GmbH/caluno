'use client';

import { type FieldType, RequiredFormTargetType } from '@repo/data';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { OrganizationRepository } from '../../repositories/organization/organization.repository';
import { RequirementFormRepository } from '../../repositories/requirementForm/requirement-form.repository';
import { useSdk } from './use-graphql-client';
import { useMutation } from './use-mutation';

export type RequiredFormField = {
  id: string;
  blockId: string;
  type: FieldType;
  label: string;
  placeholder?: string | null;
  description?: string | null;
  required: boolean;
  lockType: boolean;
  profileKey?: string | null;
  documents: Array<{
    fileId: string;
    filename?: string | null;
    downloadUrl?: string | null;
  }>;
  documentLabel?: string | null;
  minAge?: number | null;
  fieldOrder: number;
  options?: Array<string> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type RequiredFormBlock = {
  id: string;
  organizationId: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  isEditable: boolean;
  fields?: Array<RequiredFormField> | null;
};

export type RequiredFormBlockRef = {
  id: string;
  formId: string;
  blockId: string;
  fieldOrder: number;
  block: RequiredFormBlock;
};

export type RequiredForm = {
  id: string;
  name: string;
  description?: string | null;
  blockRefs?: Array<RequiredFormBlockRef> | null;
};

export function useSetRequiredForms() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new OrganizationRepository(sdk);

  return useMutation({
    mutationFn: ({
      organizationUnitId,
      formIds,
    }: {
      organizationUnitId: string;
      formIds: string[];
    }) => repository.setRequiredForms(organizationUnitId, formIds),
    onSuccess: (_, { organizationUnitId }) =>
      invalidateSetRequiredFormsQueries(queryClient, organizationUnitId),
  });
}

/**
 * Setting required forms changes what the public join page asks for, so a join
 * page opened before the change has to refetch too (VOLI-1620).
 */
export function invalidateSetRequiredFormsQueries(
  queryClient: QueryClient,
  organizationUnitId: string,
) {
  queryClient.invalidateQueries({
    queryKey: ['organization-unit', organizationUnitId],
  });
  queryClient.invalidateQueries({
    queryKey: ['publicOrganizationUnit', organizationUnitId],
  });
}

/**
 * Submitting a form flips its "already submitted" state. The mutation knows
 * neither the submitter nor, for event targets, the unit, so the submission
 * lists are refreshed by prefix (VOLI-1620).
 */
export function invalidateSubmitRequiredFormQueries(
  queryClient: QueryClient,
  targetType: RequiredFormTargetType,
  targetId: string,
) {
  if (targetType === RequiredFormTargetType.OrganizationUnit) {
    queryClient.invalidateQueries({
      queryKey: ['organization-unit', targetId],
    });
  }
  if (targetType === RequiredFormTargetType.Event) {
    queryClient.invalidateQueries({
      queryKey: ['publicEvent', targetId],
    });
    queryClient.invalidateQueries({
      queryKey: ['event', targetId],
    });
  }
  queryClient.invalidateQueries({ queryKey: ['myFormSubmissions'] });
  queryClient.invalidateQueries({ queryKey: ['formSubmissionsForVolunteer'] });
}

export function useSubmitRequiredForm() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new RequirementFormRepository(sdk);

  return useMutation({
    mutationFn: ({
      targetType,
      targetId,
      formId,
      values,
    }: {
      targetType: RequiredFormTargetType;
      targetId: string;
      formId: string;
      values: Array<{ fieldId: string; blockId: string; value: string }>;
    }) =>
      repository.submitRequiredForm(targetType, targetId, formId, { values }),
    onSuccess: (_, { targetType, targetId }) =>
      invalidateSubmitRequiredFormQueries(queryClient, targetType, targetId),
  });
}
