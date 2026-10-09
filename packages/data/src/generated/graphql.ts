/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type * as Types from './base-types';

import { GraphQLClient, type RequestOptions } from 'graphql-request';
import { gql } from 'graphql-request';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type GetReimbursementTypesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetReimbursementTypesQuery = { reimbursementTypes: Array<{ id: string, key: Types.ReimbursementTypeKey, legalReference: string, yearlyLimitCents: number, platformDefaultRateCents: number }> };

export type GetEffectiveRatesQueryVariables = Exact<{
  organizationUnitId?: string | null | undefined;
}>;


export type GetEffectiveRatesQuery = { effectiveRates: Array<{ hourlyRateCents: number, isOverride: boolean, organizationUnitId: string | null, reimbursementType: { id: string, key: Types.ReimbursementTypeKey, legalReference: string, yearlyLimitCents: number, platformDefaultRateCents: number }, provenance: { kind: Types.RateProvenanceKind, sourceName: string | null, replacesRateCents: number | null } }> };

export type SetReimbursementRateMutationVariables = Exact<{
  reimbursementTypeId: string;
  hourlyRateCents: number;
  organizationUnitId?: string | null | undefined;
}>;


export type SetReimbursementRateMutation = { setReimbursementRate: { id: string, hourlyRateCents: number } };

export type GetYearlyUsageQueryVariables = Exact<{
  volunteerId: string;
  reimbursementTypeId: string;
  year: number;
  asOfDate?: string | null | undefined;
  excludeInvoiceId?: string | null | undefined;
}>;


export type GetYearlyUsageQuery = { yearlyUsage: { usedCents: number, limitCents: number, remainingCents: number } };

export type GetVolunteerAllowanceStatesQueryVariables = Exact<{
  volunteerIds: Array<string> | string;
  shiftInstanceId?: string | null | undefined;
}>;


export type GetVolunteerAllowanceStatesQuery = { volunteerAllowanceStates: Array<{ volunteerId: string, state: Types.VolunteerAllowanceState }> };

export type GetRosterYearlyUsageQueryVariables = Exact<{
  organizationUnitId: string;
  year: number;
}>;


export type GetRosterYearlyUsageQuery = { rosterYearlyUsage: Array<{ volunteer: { id: string, name: string, image: string | null }, usageByType: Array<{ usedCents: number, limitCents: number, remainingCents: number, reimbursementType: { id: string, key: Types.ReimbursementTypeKey } }> }> };

export type ContractSummaryFieldsFragment = { id: string, contractStatus: Types.ContractStatus, periodStart: string, periodEnd: string, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, renewDate: string | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> };

export type GetContractsQueryVariables = Exact<{
  filter?: Types.ContractFilterInput | null | undefined;
}>;


export type GetContractsQuery = { contracts: Array<{ id: string, contractStatus: Types.ContractStatus, periodStart: string, periodEnd: string, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, renewDate: string | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> }> };

export type GetMyContractsQueryVariables = Exact<{
  filter?: Types.ContractFilterInput | null | undefined;
}>;


export type GetMyContractsQuery = { myContracts: Array<{ id: string, contractStatus: Types.ContractStatus, periodStart: string, periodEnd: string, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, renewDate: string | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> }> };

export type GetContractQueryVariables = Exact<{
  id: string;
}>;


export type GetContractQuery = { contract: { resolvedBody: Record<string, unknown>, id: string, contractStatus: Types.ContractStatus, periodStart: string, periodEnd: string, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, renewDate: string | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> } };

export type GetPendingContractSigneeQueryVariables = Exact<{
  contractId: string;
}>;


export type GetPendingContractSigneeQuery = { pendingContractSignee: { signeeType: Types.SigneeType, userId: string | null, permissionKey: string | null, eligibleUserIds: Array<string> | null } | null };

export type CreateContractMutationVariables = Exact<{
  input: Types.CreateContractInput;
}>;


export type CreateContractMutation = { createContract: { id: string, contractStatus: Types.ContractStatus, periodStart: string, periodEnd: string, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, renewDate: string | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> } };

export type SignContractMutationVariables = Exact<{
  contractId: string;
}>;


export type SignContractMutation = { signContract: { id: string, contractStatus: Types.ContractStatus, periodStart: string, periodEnd: string, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, renewDate: string | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> } };

export type DeclineContractMutationVariables = Exact<{
  contractId: string;
  reason: string;
}>;


export type DeclineContractMutation = { declineContract: { id: string, contractStatus: Types.ContractStatus, periodStart: string, periodEnd: string, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, renewDate: string | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> } };

export type InvoiceSummaryFieldsFragment = { id: string, invoiceStatus: Types.InvoiceStatus, periodStart: string, periodEnd: string, totalAmountCents: number, totalHours: number, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, invoiceTimeEntries: Array<{ id: string }>, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> };

export type GetInvoicesQueryVariables = Exact<{
  filter?: Types.InvoiceFilterInput | null | undefined;
}>;


export type GetInvoicesQuery = { invoices: Array<{ id: string, invoiceStatus: Types.InvoiceStatus, periodStart: string, periodEnd: string, totalAmountCents: number, totalHours: number, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, invoiceTimeEntries: Array<{ id: string }>, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> }> };

export type GetMyInvoicesQueryVariables = Exact<{
  filter?: Types.InvoiceFilterInput | null | undefined;
}>;


export type GetMyInvoicesQuery = { myInvoices: Array<{ id: string, invoiceStatus: Types.InvoiceStatus, periodStart: string, periodEnd: string, totalAmountCents: number, totalHours: number, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, invoiceTimeEntries: Array<{ id: string }>, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> }> };

export type GetInvoiceQueryVariables = Exact<{
  id: string;
}>;


export type GetInvoiceQuery = { invoice: { resolvedBody: Record<string, unknown>, id: string, invoiceStatus: Types.InvoiceStatus, periodStart: string, periodEnd: string, totalAmountCents: number, totalHours: number, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, invoiceTimeEntries: Array<{ id: string, timeEntry: { id: string, startedAt: string, endedAt: string | null, notes: string | null, shiftInstance: { id: string, overrideTitle: string | null, master: { title: string } } | null } }>, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> } };

export type GetPendingInvoiceSigneeQueryVariables = Exact<{
  invoiceId: string;
}>;


export type GetPendingInvoiceSigneeQuery = { pendingInvoiceSignee: { signeeType: Types.SigneeType, userId: string | null, permissionKey: string | null, eligibleUserIds: Array<string> | null } | null };

export type GetVolunteersNeedingTimesheetsQueryVariables = Exact<{
  periodStart?: string | null | undefined;
  periodEnd?: string | null | undefined;
}>;


export type GetVolunteersNeedingTimesheetsQuery = { volunteersNeedingTimesheets: Array<{ periodStart: string, periodEnd: string, eligibleHours: number, estimatedAmountCents: number, volunteer: { id: string, name: string }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey } }> };

export type GetPaidShiftSignupVolunteersQueryVariables = Exact<{
  year: number;
}>;


export type GetPaidShiftSignupVolunteersQuery = { paidShiftSignupVolunteers: Array<{ periodStart: string, periodEnd: string, volunteer: { id: string, name: string }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey } }> };

export type GetEligibleTimeEntriesForInvoiceQueryVariables = Exact<{
  volunteerId: string;
  reimbursementTypeId: string;
  periodStart?: string | null | undefined;
  periodEnd?: string | null | undefined;
}>;


export type GetEligibleTimeEntriesForInvoiceQuery = { eligibleTimeEntriesForInvoice: Array<{ id: string, startedAt: string, endedAt: string | null, notes: string | null, shiftInstance: { id: string, overrideTitle: string | null, master: { title: string } } | null }> };

export type CreateInvoiceMutationVariables = Exact<{
  input: Types.CreateInvoiceInput;
}>;


export type CreateInvoiceMutation = { createInvoice: { id: string, invoiceStatus: Types.InvoiceStatus, periodStart: string, periodEnd: string, totalAmountCents: number, totalHours: number, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, invoiceTimeEntries: Array<{ id: string }>, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> } };

export type SignInvoiceMutationVariables = Exact<{
  invoiceId: string;
}>;


export type SignInvoiceMutation = { signInvoice: { id: string, invoiceStatus: Types.InvoiceStatus, periodStart: string, periodEnd: string, totalAmountCents: number, totalHours: number, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, invoiceTimeEntries: Array<{ id: string }>, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> } };

export type DeclineInvoiceMutationVariables = Exact<{
  invoiceId: string;
  reason: string;
}>;


export type DeclineInvoiceMutation = { declineInvoice: { id: string, invoiceStatus: Types.InvoiceStatus, periodStart: string, periodEnd: string, totalAmountCents: number, totalHours: number, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, invoiceTimeEntries: Array<{ id: string }>, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> } };

export type DocumentTemplateSummaryFieldsFragment = { id: string, kind: Types.DocumentKind, invoiceNumberFormat: string | null, renewalCadence: Types.RenewalCadence | null, isDeleted: boolean, lastEditedAt: string | null, lastEditedByUser: { id: string, name: string } | null, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, organizationUnit: { id: string, name: string } | null, signees: Array<{ id: string, order: number, signeeType: Types.SigneeType, requiredPermission: { id: string, key: Types.PermissionKey } | null }> };

export type GetDocumentTemplatesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetDocumentTemplatesQuery = { documentTemplates: Array<{ id: string, kind: Types.DocumentKind, invoiceNumberFormat: string | null, renewalCadence: Types.RenewalCadence | null, isDeleted: boolean, lastEditedAt: string | null, lastEditedByUser: { id: string, name: string } | null, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, organizationUnit: { id: string, name: string } | null, signees: Array<{ id: string, order: number, signeeType: Types.SigneeType, requiredPermission: { id: string, key: Types.PermissionKey } | null }> }> };

export type GetDocumentTemplateQueryVariables = Exact<{
  id: string;
}>;


export type GetDocumentTemplateQuery = { documentTemplate: { body: Record<string, unknown>, id: string, kind: Types.DocumentKind, invoiceNumberFormat: string | null, renewalCadence: Types.RenewalCadence | null, isDeleted: boolean, lastEditedAt: string | null, lastEditedByUser: { id: string, name: string } | null, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, organizationUnit: { id: string, name: string } | null, signees: Array<{ id: string, order: number, signeeType: Types.SigneeType, requiredPermission: { id: string, key: Types.PermissionKey } | null }> } };

export type GetActiveDocumentTemplateQueryVariables = Exact<{
  kind: Types.DocumentKind;
  reimbursementTypeId: string;
  organizationUnitId?: string | null | undefined;
}>;


export type GetActiveDocumentTemplateQuery = { activeDocumentTemplate: { body: Record<string, unknown>, id: string, kind: Types.DocumentKind, invoiceNumberFormat: string | null, renewalCadence: Types.RenewalCadence | null, isDeleted: boolean, lastEditedAt: string | null, lastEditedByUser: { id: string, name: string } | null, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, organizationUnit: { id: string, name: string } | null, signees: Array<{ id: string, order: number, signeeType: Types.SigneeType, requiredPermission: { id: string, key: Types.PermissionKey } | null }> } };

export type CreateDocumentTemplateMutationVariables = Exact<{
  input: Types.CreateDocumentTemplateInput;
}>;


export type CreateDocumentTemplateMutation = { createDocumentTemplate: { id: string, kind: Types.DocumentKind, invoiceNumberFormat: string | null, renewalCadence: Types.RenewalCadence | null, isDeleted: boolean, lastEditedAt: string | null, lastEditedByUser: { id: string, name: string } | null, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, organizationUnit: { id: string, name: string } | null, signees: Array<{ id: string, order: number, signeeType: Types.SigneeType, requiredPermission: { id: string, key: Types.PermissionKey } | null }> } };

export type UpdateDocumentTemplateMutationVariables = Exact<{
  id: string;
  input: Types.UpdateDocumentTemplateInput;
}>;


export type UpdateDocumentTemplateMutation = { updateDocumentTemplate: { id: string, kind: Types.DocumentKind, invoiceNumberFormat: string | null, renewalCadence: Types.RenewalCadence | null, isDeleted: boolean, lastEditedAt: string | null, lastEditedByUser: { id: string, name: string } | null, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, organizationUnit: { id: string, name: string } | null, signees: Array<{ id: string, order: number, signeeType: Types.SigneeType, requiredPermission: { id: string, key: Types.PermissionKey } | null }> } };

export type DeleteDocumentTemplateMutationVariables = Exact<{
  id: string;
}>;


export type DeleteDocumentTemplateMutation = { deleteDocumentTemplate: boolean };

export type GetBundleDownloadStatusQueryVariables = Exact<{
  volunteerId: string;
  reimbursementTypeId: string;
}>;


export type GetBundleDownloadStatusQuery = { bundleDownloadStatus: { downloadedAt: string, volunteer: { id: string, name: string }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, downloadedByUser: { id: string, name: string } | null } | null };

export type RecordBundleDownloadMutationVariables = Exact<{
  volunteerId: string;
  reimbursementTypeId: string;
  invoiceIds?: Array<string> | string | null | undefined;
}>;


export type RecordBundleDownloadMutation = { recordBundleDownload: { downloadedAt: string, volunteer: { id: string, name: string }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, downloadedByUser: { id: string, name: string } | null } };

export type GetManualBaselineQueryVariables = Exact<{
  volunteerId: string;
  reimbursementTypeId: string;
  year: number;
}>;


export type GetManualBaselineQuery = { manualBaseline: { year: number, amountCents: number, updatedAt: string, volunteer: { id: string, name: string }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, updatedByUser: { id: string, name: string } | null } | null };

export type SetManualBaselineMutationVariables = Exact<{
  volunteerId: string;
  reimbursementTypeId: string;
  year: number;
  amountCents: number;
}>;


export type SetManualBaselineMutation = { setManualBaseline: { year: number, amountCents: number, updatedAt: string, volunteer: { id: string, name: string }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, updatedByUser: { id: string, name: string } | null } };

export type MyDocumentsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyDocumentsQuery = { myDocuments: Array<{ membershipId: string, organizationUnitId: string, organizationUnitName: string, organizationName: string, logoUrl: string | null, contracts: Array<{ id: string, contractStatus: Types.ContractStatus, periodStart: string, periodEnd: string, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, renewDate: string | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> }>, invoices: Array<{ id: string, invoiceStatus: Types.InvoiceStatus, periodStart: string, periodEnd: string, totalAmountCents: number, totalHours: number, isNonCompliant: boolean, declineReason: string | null, declinedAt: string | null, declinedAtSigneeType: Types.SigneeType | null, downloadUrl: string | null, missingProfileFields: Array<string>, missingOrgProfileFields: Array<string>, createdAt: string, updatedAt: string | null, declinedByUser: { id: string, name: string } | null, volunteer: { id: string, name: string, image: string | null }, reimbursementType: { id: string, key: Types.ReimbursementTypeKey }, documentTemplate: { id: string, kind: Types.DocumentKind }, invoiceTimeEntries: Array<{ id: string }>, signatures: Array<{ id: string, order: number, signeeType: Types.SigneeType, signedAt: string | null, signedByUser: { id: string, name: string } | null, requiredPermission: { id: string, key: Types.PermissionKey } | null }>, statusChanges: Array<{ id: string, type: Types.DocumentStatusChange, occurredAt: string, actorUser: { id: string, name: string } | null }> }> }> };

export type MyDocumentSummaryQueryVariables = Exact<{ [key: string]: never; }>;


export type MyDocumentSummaryQuery = { myDocumentSummary: { total: number, pending: number } };

export type GetAccountingSetupStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAccountingSetupStatusQuery = { accountingSetupStatus: { orgProfileComplete: boolean, missingOrgProfileFields: Array<string>, canCreateDocuments: boolean, orgProfile: { name: string, street: string | null, zipCode: string | null, city: string | null, legalRep: string | null } | null, slots: Array<{ reimbursementTypeId: string, reimbursementTypeKey: Types.ReimbursementTypeKey, hasContractTemplate: boolean, hasInvoiceTemplate: boolean, ready: boolean }> } };

export type EventListFieldsFragment = { id: string, title: string, slug: string, startsAt: string, endsAt: string, shiftsCount: number, requiredFormsCount: number, coverUrl: string | null, signedUpCount: number };

export type RequiredFormFieldsFragment = { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null };

export type RequiredFormRefFieldsFragment = { order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } };

export type RequiredFormWithStatusFieldsFragment = { order: number, submitted: boolean, submissionId: string | null, targetType: Types.RequiredFormTargetType, targetId: string, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } };

export type EventDetailFieldsFragment = { createdAt: string, location: string | null, coverUrl: string | null, logoUrl: string | null, id: string, title: string, slug: string, startsAt: string, endsAt: string, shiftsCount: number, requiredFormsCount: number, signedUpCount: number, organizer: { id: string, name: string, image: string | null } | null, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> };

export type GetEventsQueryVariables = Exact<{
  limit: number;
  offset: number;
}>;


export type GetEventsQuery = { events: { items: Array<{ id: string, title: string, slug: string, startsAt: string, endsAt: string, shiftsCount: number, requiredFormsCount: number, coverUrl: string | null, signedUpCount: number }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type MyEventFieldsFragment = { id: string, title: string, startsAt: string, endsAt: string, location: string | null, myInvitedAt: string | null, shiftsCount: number, coverUrl: string | null, organizationUnit: { id: string, name: string, logoUrl: string | null } | null };

export type GetMyEventsQueryVariables = Exact<{
  includePast?: boolean | null | undefined;
  startsAfter?: string | null | undefined;
  endsBefore?: string | null | undefined;
  limit?: number | null | undefined;
  offset?: number | null | undefined;
  order?: Types.SortOrder | null | undefined;
  statuses?: Array<Types.EventInviteStatus> | Types.EventInviteStatus | null | undefined;
}>;


export type GetMyEventsQuery = { myEvents: { items: Array<{ id: string, title: string, startsAt: string, endsAt: string, location: string | null, myInvitedAt: string | null, shiftsCount: number, coverUrl: string | null, organizationUnit: { id: string, name: string, logoUrl: string | null } | null }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type DiscoverEventFieldsFragment = { id: string, title: string, startsAt: string, endsAt: string, shiftsCount: number, coverUrl: string | null, organizationUnit: { id: string, name: string, logoUrl: string | null } | null };

export type GetAvailableEventsQueryVariables = Exact<{
  startsAfter?: string | null | undefined;
  endsBefore?: string | null | undefined;
  limit?: number | null | undefined;
  offset?: number | null | undefined;
  organizationUnitIds?: Array<string> | string | null | undefined;
}>;


export type GetAvailableEventsQuery = { availableEvents: { items: Array<{ id: string, title: string, startsAt: string, endsAt: string, shiftsCount: number, coverUrl: string | null, organizationUnit: { id: string, name: string, logoUrl: string | null } | null }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type GetEventQueryVariables = Exact<{
  id: string;
}>;


export type GetEventQuery = { event: { createdAt: string, location: string | null, coverUrl: string | null, logoUrl: string | null, id: string, title: string, slug: string, startsAt: string, endsAt: string, shiftsCount: number, requiredFormsCount: number, signedUpCount: number, organizer: { id: string, name: string, image: string | null } | null, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> } };

export type GetEventInvitesQueryVariables = Exact<{
  eventId: string;
}>;


export type GetEventInvitesQuery = { eventInvites: Array<{ id: string, status: Types.EventInviteStatus, user: { id: string, name: string, email: string, image: string | null, checkInId: string } }> };

export type CreateEventMutationVariables = Exact<{
  input: Types.CreateEventInput;
}>;


export type CreateEventMutation = { createEvent: { createdAt: string, location: string | null, coverUrl: string | null, logoUrl: string | null, id: string, title: string, slug: string, startsAt: string, endsAt: string, shiftsCount: number, requiredFormsCount: number, signedUpCount: number, organizer: { id: string, name: string, image: string | null } | null, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> } };

export type UpdateEventMutationVariables = Exact<{
  id: string;
  input: Types.UpdateEventInput;
}>;


export type UpdateEventMutation = { updateEvent: { createdAt: string, location: string | null, coverUrl: string | null, logoUrl: string | null, id: string, title: string, slug: string, startsAt: string, endsAt: string, shiftsCount: number, requiredFormsCount: number, signedUpCount: number, organizer: { id: string, name: string, image: string | null } | null, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> } };

export type DeleteEventMutationVariables = Exact<{
  id: string;
}>;


export type DeleteEventMutation = { deleteEvent: { id: string } };

export type InviteMembersToEventMutationVariables = Exact<{
  eventId: string;
  memberIds: Array<string> | string;
}>;


export type InviteMembersToEventMutation = { inviteMembersToEvent: { id: string } };

export type UpdateEventInviteStatusMutationVariables = Exact<{
  eventId: string;
  status: Types.EventInviteStatus;
  userId?: string | null | undefined;
}>;


export type UpdateEventInviteStatusMutation = { updateEventInviteStatus: { id: string, status: Types.EventInviteStatus, userId: string } };

export type PublicEventOrganizationUnitFieldsFragment = { id: string, name: string, slug: string, logoUrl: string | null, myMembershipState: Types.JoinStatus, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> };

export type PublicShiftInstanceFieldsFragment = { id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, overrideMaxVolunteers: number | null, filledCount: number, spotsLeft: number | null };

export type PublicShiftFieldsFragment = { id: string, title: string, maxVolunteers: number | null, instances: Array<{ id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, overrideMaxVolunteers: number | null, filledCount: number, spotsLeft: number | null }> };

export type PublicEventFieldsFragment = { id: string, title: string, slug: string, description: string | null, location: string | null, coverImageUrl: string | null, startsAt: string, endsAt: string, shiftsCount: number, myJoinStatus: Types.JoinStatus, myInviteStatus: Types.EventInviteStatus | null, organizationUnit: { id: string, name: string, slug: string, logoUrl: string | null, myMembershipState: Types.JoinStatus, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> } | null, shifts: Array<{ id: string, title: string, maxVolunteers: number | null, instances: Array<{ id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, overrideMaxVolunteers: number | null, filledCount: number, spotsLeft: number | null }> }>, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> };

export type GetPublicEventQueryVariables = Exact<{
  id: string;
}>;


export type GetPublicEventQuery = { publicEvent: { id: string, title: string, slug: string, description: string | null, location: string | null, coverImageUrl: string | null, startsAt: string, endsAt: string, shiftsCount: number, myJoinStatus: Types.JoinStatus, myInviteStatus: Types.EventInviteStatus | null, organizationUnit: { id: string, name: string, slug: string, logoUrl: string | null, myMembershipState: Types.JoinStatus, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> } | null, shifts: Array<{ id: string, title: string, maxVolunteers: number | null, instances: Array<{ id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, overrideMaxVolunteers: number | null, filledCount: number, spotsLeft: number | null }> }>, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> } };

export type JoinEventMutationVariables = Exact<{
  eventId: string;
}>;


export type JoinEventMutation = { joinEvent: { status: Types.JoinStatus, event: { id: string }, requiredForms: Array<{ order: number, submitted: boolean, submissionId: string | null, targetType: Types.RequiredFormTargetType, targetId: string, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> | null } };

export type SetEventRequiredFormsMutationVariables = Exact<{
  eventId: string;
  formIds: Array<string> | string;
}>;


export type SetEventRequiredFormsMutation = { setEventRequiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> };

export type GetOrganizationUnitMembershipsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetOrganizationUnitMembershipsQuery = { memberships: Array<{ id: string, idVerifiedAt: string | null, user: { id: string, name: string, email: string, image: string | null, checkInId: string }, organizationUnit: { id: string, name: string }, roles: Array<{ id: string, name: string, description: string | null, isInternal: boolean }>, idVerifiedBy: { id: string, name: string } | null }> };

export type GetMyMembershipStatusQueryVariables = Exact<{
  organizationUnitId: string;
}>;


export type GetMyMembershipStatusQuery = { myMembershipStatus: boolean };

export type UpdateMembershipRolesMutationVariables = Exact<{
  membershipId: string;
  roleIds: Array<string> | string;
}>;


export type UpdateMembershipRolesMutation = { updateMembershipRoles: { id: string, user: { id: string, name: string, email: string, image: string | null, checkInId: string }, organizationUnit: { id: string, name: string }, roles: Array<{ id: string, name: string, description: string | null, isInternal: boolean }> } };

export type LeaveMembershipMutationVariables = Exact<{
  id: string;
}>;


export type LeaveMembershipMutation = { leaveMembership: { id: string } };

export type RemoveMembershipMutationVariables = Exact<{
  id: string;
}>;


export type RemoveMembershipMutation = { removeMembership: { id: string } };

export type MyMembershipsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyMembershipsQuery = { myMemberships: Array<{ id: string, createdAt: string, organizationUnit: { id: string, name: string, logoUrl: string | null, type: { icon: string }, parent: { id: string } | null, organization: { name: string } }, roles: Array<{ id: string, name: string, isInternal: boolean }> }> };

export type MyMembershipQueryVariables = Exact<{
  id: string;
}>;


export type MyMembershipQuery = { myMembership: { id: string, createdAt: string, organizationUnit: { id: string, name: string, logoUrl: string | null, type: { icon: string }, parent: { id: string } | null, organization: { name: string } }, roles: Array<{ id: string, name: string, isInternal: boolean }> } | null };

export type SetMembershipIdVerifiedMutationVariables = Exact<{
  membershipId: string;
  verified: boolean;
}>;


export type SetMembershipIdVerifiedMutation = { setMembershipIdVerified: { id: string, idVerifiedAt: string | null } };

export type JoinOrganizationMutationVariables = Exact<{
  organizationUnitId: string;
}>;


export type JoinOrganizationMutation = { joinOrganization: { status: Types.JoinStatus, membershipRequestId: string | null, requirementProfile: { id: string, name: string, description: string | null, requirements: Array<{ id: string, name: string, description: string | null, type: Types.RequirementType, mandatory: boolean }> | null } | null, requirementStatuses: Array<{ requirementId: string, name: string, status: Types.RequirementFulfillmentStatus }> | null, requiredForms: Array<{ order: number, submitted: boolean, submissionId: string | null, form: { id: string, name: string, description: string | null } }> | null } };

export type ApproveMembershipRequestMutationVariables = Exact<{
  id: string;
  organizationUnitId: string;
}>;


export type ApproveMembershipRequestMutation = { approveMembershipRequest: { id: string } };

export type RejectMembershipRequestMutationVariables = Exact<{
  id: string;
  organizationUnitId: string;
  rejectionReason: string;
}>;


export type RejectMembershipRequestMutation = { rejectMembershipRequest: { id: string } };

export type CancelMembershipRequestMutationVariables = Exact<{
  id: string;
  organizationUnitId: string;
}>;


export type CancelMembershipRequestMutation = { cancelMembershipRequest: { id: string } };

export type RemoveMembershipRequestMutationVariables = Exact<{
  id: string;
}>;


export type RemoveMembershipRequestMutation = { removeMembershipRequest: { id: string } };

export type GetMembershipRequestsQueryVariables = Exact<{
  status?: Types.MembershipRequestStatus | null | undefined;
  limit: number;
  offset: number;
}>;


export type GetMembershipRequestsQuery = { membershipRequests: { items: Array<{ id: string, status: Types.MembershipRequestStatus, reviewedAt: string | null, rejectionReason: string | null, createdAt: string, updatedAt: string, organizationUnit: { id: string, name: string }, user: { id: string, name: string, email: string, image: string | null, checkInId: string }, reviewedBy: { id: string, name: string } | null }> } };

export type GetMembershipRequestCountQueryVariables = Exact<{
  status?: Types.MembershipRequestStatus | null | undefined;
}>;


export type GetMembershipRequestCountQuery = { membershipRequestCount: number };

export type GetMyMembershipRequestsQueryVariables = Exact<{
  limit: number;
  offset: number;
}>;


export type GetMyMembershipRequestsQuery = { myMembershipRequests: { items: Array<{ id: string, status: Types.MembershipRequestStatus, reviewedAt: string | null, rejectionReason: string | null, createdAt: string, organizationUnit: { id: string, name: string, logoUrl: string | null, type: { icon: string }, parent: { id: string } | null, organization: { name: string } }, user: { id: string, name: string, email: string }, contact: { name: string | null, email: string | null, phone: string | null } | null }> } };

export type CheckInApproveMembershipRequestMutationVariables = Exact<{
  requestId: string;
}>;


export type CheckInApproveMembershipRequestMutation = { checkInApproveMembershipRequest: { id: string, status: Types.MembershipRequestStatus } };

export type GetOrganizationQueryVariables = Exact<{
  id: string;
}>;


export type GetOrganizationQuery = { organization: { id: string, name: string, slug: string, description: string | null, logoUrl: string | null, websiteUrl: string | null, contactEmail: string | null, phone: string | null, street: string | null, zipCode: string | null, city: string | null, createdAt: string, updatedAt: string | null } | null };

export type GetOrganizationBySlugQueryVariables = Exact<{
  slug: string;
}>;


export type GetOrganizationBySlugQuery = { organizationBySlug: { id: string, name: string, slug: string, description: string | null, logoUrl: string | null, websiteUrl: string | null, contactEmail: string | null, phone: string | null, street: string | null, zipCode: string | null, city: string | null, createdAt: string } };

export type GetOrganizationRootQueryVariables = Exact<{
  id: string;
}>;


export type GetOrganizationRootQuery = { organization: { id: string, root: { id: string } } | null };

export type GetOrganizationUnitQueryVariables = Exact<{
  id: string;
}>;


export type GetOrganizationUnitQuery = { organizationUnit: { id: string, slug: string, name: string, description: string | null, logoUrl: string | null, websiteUrl: string | null, contactEmail: string | null, contactPersonName: string | null, phone: string | null, welcomeMessage: string | null, street: string | null, zipCode: string | null, city: string | null, legalRep: string | null, idVerificationEnabled: boolean, organizationId: string, organization: { id: string, name: string }, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }>, parent: { id: string, name: string } | null, type: { id: string, name: string, icon: string } } | null };

export type GetOrganizationVolunteersByUnitQueryVariables = Exact<{
  id: string;
}>;


export type GetOrganizationVolunteersByUnitQuery = { members: Array<{ id: string, name: string, email: string, image: string | null, checkInId: string }> };

export type GetOrganizationUnitWithOrgQueryVariables = Exact<{
  id: string;
}>;


export type GetOrganizationUnitWithOrgQuery = { organizationUnit: { id: string, name: string, organization: { name: string } } | null };

export type GetOrganizationUnitPublicInfoQueryVariables = Exact<{
  id: string;
}>;


export type GetOrganizationUnitPublicInfoQuery = { organizationUnit: { id: string, name: string, description: string | null, logoUrl: string | null, websiteUrl: string | null, contactEmail: string | null, phone: string | null } | null };

export type GetOrganizationsWithRootQueryVariables = Exact<{
  limit: number;
  offset: number;
}>;


export type GetOrganizationsWithRootQuery = { organizations: { items: Array<{ id: string, name: string, description: string | null, logoUrl: string | null, root: { id: string, slug: string, name: string, description: string | null, logoUrl: string | null, street: string | null, zipCode: string | null, city: string | null } }> } };

export type GetMyOrganizationUnitsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMyOrganizationUnitsQuery = { myOrganizationUnits: Array<{ id: string, slug: string, name: string, description: string | null, logoUrl: string | null, street: string | null, zipCode: string | null, city: string | null, legalRep: string | null, parent: { id: string } | null, organization: { id: string, name: string, description: string | null, logoUrl: string | null, accountingEnabled: boolean } }> };

export type GetMyAdminstableOrganizationUnitsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMyAdminstableOrganizationUnitsQuery = { myAdminstableOrganizationUnits: Array<{ id: string, slug: string, name: string, description: string | null, logoUrl: string | null, street: string | null, zipCode: string | null, city: string | null, legalRep: string | null, parent: { id: string } | null, organization: { id: string, name: string, description: string | null, logoUrl: string | null, accountingEnabled: boolean } }> };

export type GetMyCheckInAdministrableOrganizationUnitsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMyCheckInAdministrableOrganizationUnitsQuery = { myCheckInAdministrableOrganizationUnits: Array<{ id: string, slug: string, name: string, description: string | null, logoUrl: string | null, street: string | null, zipCode: string | null, city: string | null, legalRep: string | null, parent: { id: string } | null, organization: { id: string, name: string, description: string | null, logoUrl: string | null, accountingEnabled: boolean } }> };

export type GetOrganizationsQueryVariables = Exact<{
  limit: number;
  offset: number;
}>;


export type GetOrganizationsQuery = { organizations: { items: Array<{ id: string, name: string, slug: string, description: string | null, logoUrl: string | null, createdAt: string }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type CreateOrganizationMutationVariables = Exact<{
  input: Types.CreateOrganizationInput;
}>;


export type CreateOrganizationMutation = { createOrganization: { id: string, name: string, slug: string, description: string | null, logoUrl: string | null, websiteUrl: string | null, createdAt: string, root: { id: string } } };

export type UpdateOrganizationMutationVariables = Exact<{
  id: string;
  input: Types.UpdateOrganizationInput;
}>;


export type UpdateOrganizationMutation = { updateOrganization: { id: string, name: string, street: string | null, zipCode: string | null, city: string | null } };

export type GetOrganizationTreeQueryVariables = Exact<{ [key: string]: never; }>;


export type GetOrganizationTreeQuery = { organizationTree: { root: Record<string, unknown> } | null };

export type GetOrganizationUnitTypesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetOrganizationUnitTypesQuery = { organizationUnitTypes: Array<{ id: string, name: string, description: string | null, icon: string }> };

export type CreateOrganizationUnitMutationVariables = Exact<{
  input: Types.CreateOrganizationUnitInput;
}>;


export type CreateOrganizationUnitMutation = { createOrganizationUnit: { id: string, name: string, slug: string, deletedAt: string | null, parent: { id: string, name: string } | null, type: { id: string, name: string, icon: string } } };

export type UpdateOrganizationUnitMutationVariables = Exact<{
  id: string;
  input: Types.UpdateOrganizationUnitInput;
}>;


export type UpdateOrganizationUnitMutation = { updateOrganizationUnit: { id: string, name: string, slug: string, deletedAt: string | null, street: string | null, zipCode: string | null, city: string | null, legalRep: string | null, idVerificationEnabled: boolean, parent: { id: string } | null, type: { id: string, name: string, icon: string } } };

export type RequestOrganizationUnitDeletionMutationVariables = Exact<{
  id: string;
  message?: string | null | undefined;
}>;


export type RequestOrganizationUnitDeletionMutation = { requestOrganizationUnitDeletion: { id: string, name: string } };

export type IsMemberOfOrgUnitOrAncestorQueryVariables = Exact<{
  organizationUnitId: string;
  userId: string;
}>;


export type IsMemberOfOrgUnitOrAncestorQuery = { isMemberOfUnitOrAncestor: boolean };

export type SetRequiredFormsMutationVariables = Exact<{
  organizationUnitId: string;
  formIds: Array<string> | string;
}>;


export type SetRequiredFormsMutation = { setRequiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null } }> };

export type OrganizationUnitAutomationFieldsFragment = { organizationUnitId: string, kind: Types.OrganizationUnitAutomationKind, enabled: boolean, activeDays: Array<Types.Weekday>, leadTimeHours: number | null, sendAtTime: string | null };

export type GetOrganizationUnitAutomationsQueryVariables = Exact<{
  organizationUnitId: string;
}>;


export type GetOrganizationUnitAutomationsQuery = { organizationUnitAutomations: Array<{ organizationUnitId: string, kind: Types.OrganizationUnitAutomationKind, enabled: boolean, activeDays: Array<Types.Weekday>, leadTimeHours: number | null, sendAtTime: string | null }> };

export type UpdateOrganizationUnitAutomationMutationVariables = Exact<{
  organizationUnitId: string;
  kind: Types.OrganizationUnitAutomationKind;
  input: Types.UpdateOrganizationUnitAutomationInput;
}>;


export type UpdateOrganizationUnitAutomationMutation = { updateOrganizationUnitAutomation: { organizationUnitId: string, kind: Types.OrganizationUnitAutomationKind, enabled: boolean, activeDays: Array<Types.Weekday>, leadTimeHours: number | null, sendAtTime: string | null } };

export type PublicOrganizationUnitFieldsFragment = { id: string, name: string, slug: string, description: string | null, logoUrl: string | null, coverUrl: string | null, street: string | null, zipCode: string | null, city: string | null, memberCount: number, openShiftsCount: number, myMembershipState: Types.JoinStatus };

export type PublicOrgEventFieldsFragment = { id: string, title: string, slug: string, startsAt: string, endsAt: string, location: string | null, shiftsCount: number, shifts: Array<{ id: string, instances: Array<{ id: string, spotsLeft: number | null }> }> };

export type PublicOrgShiftInstanceFieldsFragment = { id: string, actualStartsAt: string, actualEndsAt: string, overrideMaxVolunteers: number | null, filledCount: number, spotsLeft: number | null };

export type PublicOrgShiftFieldsFragment = { id: string, title: string, maxVolunteers: number | null, rrule: string | null, originalStartsAt: string, durationMinutes: number, instances: Array<{ id: string, actualStartsAt: string, actualEndsAt: string, overrideMaxVolunteers: number | null, filledCount: number, spotsLeft: number | null }> };

export type GetPublicOrganizationUnitQueryVariables = Exact<{
  id: string;
}>;


export type GetPublicOrganizationUnitQuery = { publicOrganizationUnit: { id: string, name: string, slug: string, description: string | null, logoUrl: string | null, coverUrl: string | null, street: string | null, zipCode: string | null, city: string | null, memberCount: number, openShiftsCount: number, myMembershipState: Types.JoinStatus } };

export type GetPublicEventsByOrganizationUnitQueryVariables = Exact<{
  organizationUnitId: string;
}>;


export type GetPublicEventsByOrganizationUnitQuery = { publicEventsByOrganizationUnit: Array<{ id: string, title: string, slug: string, startsAt: string, endsAt: string, location: string | null, shiftsCount: number, shifts: Array<{ id: string, instances: Array<{ id: string, spotsLeft: number | null }> }> }> };

export type GetPublicShiftsByOrganizationUnitQueryVariables = Exact<{
  organizationUnitId: string;
}>;


export type GetPublicShiftsByOrganizationUnitQuery = { publicShiftsByOrganizationUnit: Array<{ id: string, title: string, maxVolunteers: number | null, rrule: string | null, originalStartsAt: string, durationMinutes: number, instances: Array<{ id: string, actualStartsAt: string, actualEndsAt: string, overrideMaxVolunteers: number | null, filledCount: number, spotsLeft: number | null }> }> };

export type GetFormBlockQueryVariables = Exact<{
  id: string;
}>;


export type GetFormBlockQuery = { formBlock: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, createdBy: string, updatedBy: string, createdAt: string, updatedAt: string, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, createdAt: string, updatedAt: string, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null };

export type GetFormBlocksQueryVariables = Exact<{
  organizationId: string;
  limit: number;
  offset: number;
}>;


export type GetFormBlocksQuery = { formBlocks: { items: Array<{ id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, createdBy: string, updatedBy: string, createdAt: string, updatedAt: string, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, createdAt: string, updatedAt: string, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type CreateFormBlockMutationVariables = Exact<{
  input: Types.CreateFormBlockInput;
}>;


export type CreateFormBlockMutation = { createFormBlock: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, createdBy: string, updatedBy: string, createdAt: string, updatedAt: string, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, createdAt: string, updatedAt: string, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } };

export type UpdateFormBlockMutationVariables = Exact<{
  id: string;
  input: Types.UpdateFormBlockInput;
}>;


export type UpdateFormBlockMutation = { updateFormBlock: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, createdBy: string, updatedBy: string, createdAt: string, updatedAt: string, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, createdAt: string, updatedAt: string, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } };

export type DeleteFormBlockMutationVariables = Exact<{
  id: string;
}>;


export type DeleteFormBlockMutation = { deleteFormBlock: { id: string } };

export type CreateFormBlockFieldMutationVariables = Exact<{
  blockId: string;
  input: Types.CreateFormBlockFieldInput;
}>;


export type CreateFormBlockFieldMutation = { createFormBlockField: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, createdBy: string, updatedBy: string, createdAt: string, updatedAt: string, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, createdAt: string, updatedAt: string, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } };

export type UpdateFormBlockFieldMutationVariables = Exact<{
  fieldId: string;
  input: Types.UpdateFormBlockFieldInput;
}>;


export type UpdateFormBlockFieldMutation = { updateFormBlockField: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, createdBy: string, updatedBy: string, createdAt: string, updatedAt: string, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, createdAt: string, updatedAt: string, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } };

export type DeleteFormBlockFieldMutationVariables = Exact<{
  fieldId: string;
}>;


export type DeleteFormBlockFieldMutation = { deleteFormBlockField: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, createdBy: string, updatedBy: string, createdAt: string, updatedAt: string, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, createdAt: string, updatedAt: string, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } };

export type GetRequirementFormQueryVariables = Exact<{
  id: string;
}>;


export type GetRequirementFormQuery = { requirementForm: { id: string, organizationId: string, organizationUnitId: string | null, slug: string, name: string, description: string | null, shareToken: string, submissionCount: number, createdBy: string, updatedBy: string, createdAt: string, updatedAt: string, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null, allowEmbed: boolean | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, createdAt: string, updatedAt: string, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, createdBy: string, updatedBy: string, createdAt: string, updatedAt: string, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, createdAt: string, updatedAt: string, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } | null };

export type GetRequirementFormByShareTokenQueryVariables = Exact<{
  token: string;
}>;


export type GetRequirementFormByShareTokenQuery = { requirementFormByShareToken: { id: string, organizationUnitId: string | null, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null, allowEmbed: boolean | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, title: string, description: string | null, icon: string | null, required: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, systemKey: string | null, documentLabel: string | null, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } | null };

export type GetRequirementFormsQueryVariables = Exact<{
  organizationId: string;
  limit: number;
  offset: number;
}>;


export type GetRequirementFormsQuery = { requirementForms: { items: Array<{ id: string, organizationId: string, organizationUnitId: string | null, slug: string, name: string, description: string | null, shareToken: string, submissionCount: number, createdBy: string, updatedBy: string, createdAt: string, updatedAt: string, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null, allowEmbed: boolean | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, createdAt: string, updatedAt: string, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, createdBy: string, updatedBy: string, createdAt: string, updatedAt: string } | null }> | null }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type CreateRequirementFormMutationVariables = Exact<{
  input: Types.CreateRequirementFormInput;
}>;


export type CreateRequirementFormMutation = { createRequirementForm: { id: string, organizationId: string, organizationUnitId: string | null, slug: string, name: string, description: string | null, shareToken: string, submissionCount: number, createdAt: string, updatedAt: string } };

export type UpdateRequirementFormMutationVariables = Exact<{
  id: string;
  input: Types.UpdateRequirementFormInput;
}>;


export type UpdateRequirementFormMutation = { updateRequirementForm: { id: string, organizationId: string, organizationUnitId: string | null, slug: string, name: string, description: string | null, shareToken: string, submissionCount: number, updatedAt: string } };

export type DeleteRequirementFormMutationVariables = Exact<{
  id: string;
}>;


export type DeleteRequirementFormMutation = { deleteRequirementForm: { id: string } };

export type RegenerateFormShareTokenMutationVariables = Exact<{
  id: string;
}>;


export type RegenerateFormShareTokenMutation = { regenerateFormShareToken: { id: string, shareToken: string } };

export type SubmitFormMutationVariables = Exact<{
  token: string;
  organizationUnitId: string;
  input: Types.SubmitFormInput;
}>;


export type SubmitFormMutation = { submitForm: { id: string, formId: string, userId: string, submittedAt: string } };

export type SubmitRequiredFormMutationVariables = Exact<{
  targetType: Types.RequiredFormTargetType;
  targetId: string;
  formId: string;
  input: Types.SubmitFormInput;
}>;


export type SubmitRequiredFormMutation = { submitRequiredForm: { id: string, formId: string, userId: string, submittedAt: string } };

export type GetMyFormSubmissionByTokenQueryVariables = Exact<{
  token: string;
}>;


export type GetMyFormSubmissionByTokenQuery = { myFormSubmissionByToken: { id: string, formId: string, userId: string, submittedAt: string } | null };

export type GetMyFormSubmissionsQueryVariables = Exact<{
  organizationUnitId: string;
}>;


export type GetMyFormSubmissionsQuery = { myFormSubmissions: Array<{ id: string, submittedAt: string, form: { id: string, name: string, description: string | null, shareToken: string } | null }> };

export type GetFormSubmissionsByMembershipRequestQueryVariables = Exact<{
  membershipRequestId: string;
}>;


export type GetFormSubmissionsByMembershipRequestQuery = { formSubmissionsByMembershipRequest: Array<{ id: string, submittedAt: string, form: { id: string, name: string } | null }> };

export type GetFormSubmissionsForVolunteerQueryVariables = Exact<{
  userId: string;
}>;


export type GetFormSubmissionsForVolunteerQuery = { formSubmissionsForVolunteer: Array<{ id: string, submittedAt: string, form: { id: string, name: string } | null }> };

export type GetAdminFormSubmissionQueryVariables = Exact<{
  id: string;
}>;


export type GetAdminFormSubmissionQuery = { adminVolunteerSubmission: { id: string, submittedAt: string, user: { id: string, name: string, email: string, checkInId: string } | null, form: { id: string, name: string, blockRefs: Array<{ fieldOrder: number, block: { id: string, fields: Array<{ id: string, label: string, type: Types.FieldType, systemKey: string | null, options: Array<{ label: string, value: string }> | null }> | null } | null }> | null } | null, values: Array<{ fieldId: string, value: string }> | null } | null };

export type GetFormSubmissionsByFormQueryVariables = Exact<{
  formId: string;
  limit: number;
  offset: number;
}>;


export type GetFormSubmissionsByFormQuery = { formSubmissionsByForm: { items: Array<{ id: string, submittedAt: string, user: { id: string, name: string, email: string, checkInId: string, image: string | null } | null }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type MyRequiredOrgUnitFormsQueryVariables = Exact<{
  organizationUnitId: string;
}>;


export type MyRequiredOrgUnitFormsQuery = { myRequiredOrgUnitForms: Array<{ id: string, name: string, description: string | null, shareToken: string }> };

export type MyFormSubmissionQueryVariables = Exact<{
  id: string;
}>;


export type MyFormSubmissionQuery = { myFormSubmission: { id: string, submittedAt: string, form: { id: string, name: string, blockRefs: Array<{ fieldOrder: number, block: { id: string, fields: Array<{ id: string, label: string, type: Types.FieldType, systemKey: string | null, options: Array<{ label: string, value: string }> | null }> | null } | null }> | null } | null, values: Array<{ fieldId: string, value: string }> | null } | null };

export type GetAdminUserProfileQueryVariables = Exact<{
  userId: string;
}>;


export type GetAdminUserProfileQuery = { user: { id: string, email: string, firstname: string, lastname: string, preferredName: string | null, gender: string | null, phone: string | null, street: string | null, zip: string | null, city: string | null, birthdate: string | null, iban: string | null, accountHolder: string | null, bic: string | null } | null };

export type CreateRequirementProfileSubmissionMutationVariables = Exact<{
  input: Types.CreateRequirementProfileSubmissionInput;
}>;


export type CreateRequirementProfileSubmissionMutation = { createRequirementProfileSubmission: { id: string, status: Types.RequirementProfileSubmissionStatus, requirementProfile: { id: string, name: string } } };

export type GetRoleQueryVariables = Exact<{
  id: string;
}>;


export type GetRoleQuery = { role: { id: string, name: string, description: string | null, isInternal: boolean, permissions: Array<{ id: string, key: Types.PermissionKey, description: string | null }> } };

export type GetRolesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRolesQuery = { roles: Array<{ id: string, name: string, description: string | null, isInternal: boolean, permissions: Array<{ id: string, key: Types.PermissionKey, description: string | null }> }> };

export type GetPermissionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetPermissionsQuery = { permissions: Array<{ id: string, key: Types.PermissionKey, description: string | null }> };

export type GetPermissionGroupsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetPermissionGroupsQuery = { permissionGroups: Array<{ key: string, label: string, items: Array<{ label: string, permission: { id: string, key: Types.PermissionKey, description: string | null } }> }> };

export type CreateRoleMutationVariables = Exact<{
  input: Types.CreateRoleInput;
}>;


export type CreateRoleMutation = { createRole: { id: string, name: string, description: string | null, permissions: Array<{ id: string, key: Types.PermissionKey }> } };

export type UpdateRoleMutationVariables = Exact<{
  id: string;
  input: Types.CreateRoleInput;
}>;


export type UpdateRoleMutation = { updateRole: { id: string, name: string, description: string | null, permissions: Array<{ id: string, key: Types.PermissionKey }> } };

export type DeleteRoleMutationVariables = Exact<{
  id: string;
}>;


export type DeleteRoleMutation = { deleteRole: { id: string, name: string } };

export type GetShiftQueryVariables = Exact<{
  id: string;
}>;


export type GetShiftQuery = { shift: { id: string, title: string, slug: string, instructions: string | null, location: string | null, imageUrl: string | null, visibility: Types.ShiftVisibility, joinRequiresApproval: boolean, createdAt: string, maxVolunteers: number | null, minVolunteers: number | null, reimbursementTypeId: string | null, rrule: string | null, originalStartsAt: string, durationMinutes: number, organizationUnitId: string, reimbursementTypeKey: Types.ReimbursementTypeKey | null, requiredFormsCount: number, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }>, organizationUnit: { id: string, name: string, logoUrl: string | null, myMembershipState: Types.JoinStatus, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }>, organization: { id: string, name: string } }, createdBy: { id: string, name: string, image: string | null } | null, event: { id: string, title: string, coverImageUrl: string | null } | null } };

export type GetShiftsQueryVariables = Exact<{
  limit: number;
  offset: number;
}>;


export type GetShiftsQuery = { shifts: { items: Array<{ id: string, title: string, rrule: string | null, originalStartsAt: string, durationMinutes: number, visibility: Types.ShiftVisibility, maxVolunteers: number | null, minVolunteers: number | null, reimbursementTypeId: string | null, requiredFormsCount: number, createdBy: { id: string, name: string, email: string } | null }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type GetEventShiftsQueryVariables = Exact<{
  eventId: string;
  limit: number;
  offset: number;
}>;


export type GetEventShiftsQuery = { eventShifts: { items: Array<{ id: string, title: string, rrule: string | null, originalStartsAt: string, durationMinutes: number, visibility: Types.ShiftVisibility, maxVolunteers: number | null, minVolunteers: number | null, requiredFormsCount: number, createdBy: { id: string, name: string, email: string } | null }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type GetShiftInstancesByMasterIdsQueryVariables = Exact<{
  masterIds: Array<string> | string;
}>;


export type GetShiftInstancesByMasterIdsQuery = { shiftInstancesByMasterIds: Array<{ masterId: string, instances: Array<{ id: string, masterId: string }> }> };

export type CreateShiftMutationVariables = Exact<{
  input: Types.CreateShiftInput;
}>;


export type CreateShiftMutation = { createShift: { id: string } };

export type UpdateShiftMutationVariables = Exact<{
  id: string;
  input: Types.UpdateShiftInput;
}>;


export type UpdateShiftMutation = { updateShift: { id: string } };

export type DuplicateShiftMutationVariables = Exact<{
  id: string;
  input: Types.DuplicateShiftInput;
}>;


export type DuplicateShiftMutation = { duplicateShift: { id: string } };

export type DeleteShiftMutationVariables = Exact<{
  id: string;
}>;


export type DeleteShiftMutation = { deleteShift: { id: string } };

export type SetShiftRequiredFormsMutationVariables = Exact<{
  shiftId: string;
  formIds: Array<string> | string;
}>;


export type SetShiftRequiredFormsMutation = { setShiftRequiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> };

export type SetShiftInstanceRequiredFormsMutationVariables = Exact<{
  instanceId: string;
  formIds: Array<string> | string;
}>;


export type SetShiftInstanceRequiredFormsMutation = { setShiftInstanceRequiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> };

export type UpdateMembersForShiftInstanceMutationVariables = Exact<{
  instanceId: string;
  memberIds: Array<string> | string;
  inviteToAllInstances?: boolean | null | undefined;
}>;


export type UpdateMembersForShiftInstanceMutation = { updateMembersForShiftInstance: { id: string } };

export type UpdateShiftInstanceMutationVariables = Exact<{
  instanceId: string;
  input: Types.UpdateShiftInstanceInput;
  applyToAllFuture?: boolean | null | undefined;
}>;


export type UpdateShiftInstanceMutation = { updateShiftInstance: { id: string } };

export type DeleteShiftInstanceMutationVariables = Exact<{
  id: string;
  applyToAllFuture?: boolean | null | undefined;
}>;


export type DeleteShiftInstanceMutation = { deleteShiftInstance: { id: string, isCancelled: boolean } };

export type UpdateShiftInstanceApprovalMutationVariables = Exact<{
  id: string;
  joinRequiresApproval: boolean;
  applyToAllFuture?: boolean | null | undefined;
}>;


export type UpdateShiftInstanceApprovalMutation = { updateShiftInstanceApproval: { id: string, overrideJoinRequiresApproval: boolean | null, master: { id: string, joinRequiresApproval: boolean } } };

export type UpdateShiftInstanceVolunteersMutationVariables = Exact<{
  instanceId: string;
  memberIds: Array<string> | string;
}>;


export type UpdateShiftInstanceVolunteersMutation = { updateMembersForShiftInstance: { id: string } };

export type UpdateShiftInstanceInviteStatusMutationVariables = Exact<{
  instanceId: string;
  status: Types.ShiftInviteStatus;
  userId?: string | null | undefined;
}>;


export type UpdateShiftInstanceInviteStatusMutation = { updateShiftInstanceInviteStatus: { status: Types.ShiftInviteStatus, userId: string } };

export type SendShiftInstanceCallOutMutationVariables = Exact<{
  instanceId: string;
}>;


export type SendShiftInstanceCallOutMutation = { sendShiftInstanceCallOut: { recipientCount: number, sentToManagerFallback: boolean } };

export type RemindShiftInstanceInviteMutationVariables = Exact<{
  instanceId: string;
  userId: string;
}>;


export type RemindShiftInstanceInviteMutation = { remindShiftInstanceInvite: string };

export type GetShiftInstanceCallOutSummaryQueryVariables = Exact<{
  id: string;
}>;


export type GetShiftInstanceCallOutSummaryQuery = { shiftInstance: { id: string, lastCallOut: { sentAt: string, recipientCount: number, source: Types.ShiftCallOutSource, sentBy: { id: string, name: string, image: string | null } } | null } };

export type GetShiftInstanceCallOutHistoryQueryVariables = Exact<{
  id: string;
}>;


export type GetShiftInstanceCallOutHistoryQuery = { shiftInstance: { id: string, callOuts: Array<{ sentAt: string, recipientCount: number, source: Types.ShiftCallOutSource, sentBy: { id: string, name: string, image: string | null } }> | null } };

export type JoinShiftInstanceMutationVariables = Exact<{
  instanceId: string;
}>;


export type JoinShiftInstanceMutation = { joinShiftInstance: { status: Types.JoinStatus, membershipRequestId: string | null, shiftInstance: { id: string, myInviteStatus: Types.ShiftInviteStatus | null, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, overrideInstructions: string | null, overrideLocation: string | null, overrideMaxVolunteers: number | null, isException: boolean, isCancelled: boolean, occurrenceIndex: number, master: { id: string, title: string } }, requirementProfile: { id: string, name: string, description: string | null, requirements: Array<{ id: string, name: string, description: string | null, type: Types.RequirementType, mandatory: boolean }> | null } | null, requirementStatuses: Array<{ requirementId: string, name: string, status: Types.RequirementFulfillmentStatus }> | null, requiredForms: Array<{ order: number, submitted: boolean, submissionId: string | null, targetType: Types.RequiredFormTargetType, targetId: string, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> | null } };

export type GetShiftVolunteersQueryVariables = Exact<{
  instanceId: string;
  statuses?: Array<Types.ShiftInviteStatus> | Types.ShiftInviteStatus | null | undefined;
}>;


export type GetShiftVolunteersQuery = { shiftVolunteers: Array<{ id: string, name: string, email: string, image: string | null }> };

export type GetActiveShiftInstancesQueryVariables = Exact<{
  userId: string;
}>;


export type GetActiveShiftInstancesQuery = { activeShiftInstances: Array<{ id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, invite: { status: Types.ShiftInviteStatus } | null, master: { id: string, title: string, location: string | null, instructions: string | null, visibility: Types.ShiftVisibility, maxVolunteers: number | null } }> };

export type GetShiftInstancesQueryVariables = Exact<{
  shiftId: string;
}>;


export type GetShiftInstancesQuery = { shiftInstances: Array<{ id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, isCancelled: boolean }> };

export type GetShiftInstanceQueryVariables = Exact<{
  id: string;
}>;


export type GetShiftInstanceQuery = { shiftInstance: { id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, overrideLocation: string | null, overrideInstructions: string | null, overrideMaxVolunteers: number | null, overrideMinVolunteers: number | null, overrideReimbursementTypeId: string | null, overrideJoinRequiresApproval: boolean | null, isCancelled: boolean, filledCount: number, spotsLeft: number | null, requiredFormsCount: number, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }>, master: { id: string, title: string, location: string | null, instructions: string | null, minVolunteers: number | null, maxVolunteers: number | null, reimbursementTypeId: string | null, joinRequiresApproval: boolean, visibility: Types.ShiftVisibility, rrule: string | null, createdAt: string, imageUrl: string | null, createdBy: { id: string, name: string, image: string | null } | null }, invites: Array<{ status: Types.ShiftInviteStatus, remindedAt: string | null, user: { id: string, name: string, email: string, image: string | null, checkInId: string } }> | null, timeEntries: Array<{ id: string, startedAt: string, endedAt: string | null, volunteer: { id: string } }> } };

export type GetWeeklyShiftsQueryVariables = Exact<{
  startsAfter: string;
  endsBefore: string;
  eventId?: string | null | undefined;
}>;


export type GetWeeklyShiftsQuery = { weeklyShifts: Array<{ id: string, overrideTitle: string | null, actualStartsAt: string, actualEndsAt: string, isCancelled: boolean, overrideMinVolunteers: number | null, overrideMaxVolunteers: number | null, overrideReimbursementTypeId: string | null, master: { id: string, title: string, minVolunteers: number | null, maxVolunteers: number | null, visibility: Types.ShiftVisibility, rrule: string | null, reimbursementTypeId: string | null }, volunteers: Array<{ id: string, name: string }> | null, invites: Array<{ status: Types.ShiftInviteStatus, user: { id: string, name: string, email: string, image: string | null } }> | null }> };

export type PublicShiftDetailInstanceFieldsFragment = { id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, overrideMaxVolunteers: number | null, reimbursementTypeKey: Types.ReimbursementTypeKey | null, overrideJoinRequiresApproval: boolean | null, filledCount: number, spotsLeft: number | null, myInviteStatus: Types.ShiftInviteStatus | null, isIntendingToJoin: boolean, requiredFormsCount: number, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> };

export type GetPublicShiftInstancesQueryVariables = Exact<{
  shiftId: string;
}>;


export type GetPublicShiftInstancesQuery = { publicShiftInstances: Array<{ id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, overrideMaxVolunteers: number | null, reimbursementTypeKey: Types.ReimbursementTypeKey | null, overrideJoinRequiresApproval: boolean | null, filledCount: number, spotsLeft: number | null, myInviteStatus: Types.ShiftInviteStatus | null, isIntendingToJoin: boolean, requiredFormsCount: number, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> }> };

export type GetPublicShiftInstanceQueryVariables = Exact<{
  id: string;
}>;


export type GetPublicShiftInstanceQuery = { publicShiftInstance: { id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, overrideMaxVolunteers: number | null, reimbursementTypeKey: Types.ReimbursementTypeKey | null, overrideJoinRequiresApproval: boolean | null, filledCount: number, spotsLeft: number | null, myInviteStatus: Types.ShiftInviteStatus | null, isIntendingToJoin: boolean, requiredFormsCount: number, requiredForms: Array<{ order: number, form: { id: string, name: string, description: string | null, settings: { submitButtonLabel: string | null, successTitle: string | null, successMessage: string | null }, blockRefs: Array<{ id: string, formId: string, blockId: string, fieldOrder: number, required: boolean | null, block: { id: string, organizationId: string, title: string, description: string | null, icon: string | null, required: boolean, isEditable: boolean, fields: Array<{ id: string, blockId: string, type: Types.FieldType, label: string, placeholder: string | null, description: string | null, required: boolean, lockType: boolean, systemKey: string | null, documentLabel: string | null, minAge: number | null, fieldOrder: number, options: Array<{ label: string, value: string }> | null, documents: Array<{ fileId: string, filename: string | null, downloadUrl: string | null }> }> | null } | null }> | null } }> } };

export type VolunteerHomeShiftInstanceFragment = { id: string, overrideTitle: string | null, actualStartsAt: string, actualEndsAt: string, isCheckedIn: boolean, reimbursementTypeKey: Types.ReimbursementTypeKey | null, filledCount: number, spotsLeft: number | null, myInviteStatus: Types.ShiftInviteStatus | null, myInvitedAt: string | null, isIntendingToJoin: boolean, master: { id: string, title: string, location: string | null, rrule: string | null, maxVolunteers: number | null, organizationUnit: { id: string, name: string, logoUrl: string | null }, event: { id: string, title: string, coverImageUrl: string | null } | null } };

export type GetMyShiftInstancesQueryVariables = Exact<{
  includePast?: boolean | null | undefined;
  startsAfter?: string | null | undefined;
  endsBefore?: string | null | undefined;
  limit?: number | null | undefined;
  offset?: number | null | undefined;
  order?: Types.SortOrder | null | undefined;
  statuses?: Array<Types.ShiftInviteStatus> | Types.ShiftInviteStatus | null | undefined;
  includeIntended?: boolean | null | undefined;
}>;


export type GetMyShiftInstancesQuery = { myShiftInstances: { items: Array<{ id: string, overrideTitle: string | null, actualStartsAt: string, actualEndsAt: string, isCheckedIn: boolean, reimbursementTypeKey: Types.ReimbursementTypeKey | null, filledCount: number, spotsLeft: number | null, myInviteStatus: Types.ShiftInviteStatus | null, myInvitedAt: string | null, isIntendingToJoin: boolean, master: { id: string, title: string, location: string | null, rrule: string | null, maxVolunteers: number | null, organizationUnit: { id: string, name: string, logoUrl: string | null }, event: { id: string, title: string, coverImageUrl: string | null } | null } }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type GetAvailableShiftInstancesQueryVariables = Exact<{
  startsAfter?: string | null | undefined;
  endsBefore?: string | null | undefined;
  organizationUnitIds?: Array<string> | string | null | undefined;
  limit?: number | null | undefined;
  offset?: number | null | undefined;
}>;


export type GetAvailableShiftInstancesQuery = { availableShiftInstances: { items: Array<{ id: string, overrideTitle: string | null, actualStartsAt: string, actualEndsAt: string, isCheckedIn: boolean, reimbursementTypeKey: Types.ReimbursementTypeKey | null, filledCount: number, spotsLeft: number | null, myInviteStatus: Types.ShiftInviteStatus | null, myInvitedAt: string | null, isIntendingToJoin: boolean, master: { id: string, title: string, location: string | null, rrule: string | null, maxVolunteers: number | null, organizationUnit: { id: string, name: string, logoUrl: string | null }, event: { id: string, title: string, coverImageUrl: string | null } | null } }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type GetAvailableShiftInstanceDayCountsQueryVariables = Exact<{
  startsAfter?: string | null | undefined;
  endsBefore?: string | null | undefined;
  organizationUnitIds?: Array<string> | string | null | undefined;
  excludeIntended?: boolean | null | undefined;
}>;


export type GetAvailableShiftInstanceDayCountsQuery = { availableShiftInstanceDayCounts: Array<{ date: string, count: number }> };

export type CheckInMutationVariables = Exact<{
  shiftInstanceId: string;
}>;


export type CheckInMutation = { checkIn: { id: string } };

export type CheckOutMutationVariables = Exact<{
  shiftInstanceId: string;
}>;


export type CheckOutMutation = { checkOut: { id: string } };

export type GetCheckInShiftInstancesQueryVariables = Exact<{
  startsAfter: string;
  endsBefore: string;
}>;


export type GetCheckInShiftInstancesQuery = { checkInShiftInstances: Array<{ id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, master: { id: string, title: string } }> };

export type GetCheckInShiftsQueryVariables = Exact<{
  search?: string | null | undefined;
}>;


export type GetCheckInShiftsQuery = { checkInShifts: Array<{ id: string, title: string }> };

export type CheckInInviteToShiftInstanceMutationVariables = Exact<{
  shiftInstanceId: string;
  volunteerId: string;
}>;


export type CheckInInviteToShiftInstanceMutation = { checkInInviteToShiftInstance: { id: string } };

export type TermsStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type TermsStatusQuery = { termsStatus: { mustAccept: boolean, currentVersion: string | null, currentClass: string | null, acceptedVersion: string | null, acceptedAt: string | null } };

export type AcceptTermsMutationVariables = Exact<{
  input: Types.AcceptTermsInput;
}>;


export type AcceptTermsMutation = { acceptTerms: { mustAccept: boolean, currentVersion: string | null, currentClass: string | null, acceptedVersion: string | null, acceptedAt: string | null } };

export type AddTimeEntryMutationVariables = Exact<{
  input: Types.AddTimeEntryInput;
}>;


export type AddTimeEntryMutation = { addTimeEntry: { id: string } };

export type DeleteTimeEntryMutationVariables = Exact<{
  id: string;
}>;


export type DeleteTimeEntryMutation = { deleteTimeEntry: { id: string } };

export type CloseTimeEntryMutationVariables = Exact<{
  id: string;
  input: Types.CloseTimeEntryInput;
}>;


export type CloseTimeEntryMutation = { closeTimeEntry: { id: string } };

export type GetTimeEntryQueryVariables = Exact<{
  id: string;
}>;


export type GetTimeEntryQuery = { timeEntry: { id: string, startedAt: string, endedAt: string | null, notes: string | null, createdAt: string, isPaid: boolean, createdBy: { id: string, name: string, email: string } | null, reimbursementType: { id: string, key: Types.ReimbursementTypeKey } | null, volunteer: { id: string, name: string, email: string }, shiftInstance: { id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, master: { id: string, title: string } } | null, organizationUnit: { id: string, name: string, organization: { id: string, name: string } } } };

export type UpdateTimeEntryMutationVariables = Exact<{
  id: string;
  input: Types.UpdateTimeEntryInput;
}>;


export type UpdateTimeEntryMutation = { updateTimeEntry: { id: string } };

export type GetTimeEntriesQueryVariables = Exact<{
  limit: number;
  offset: number;
  sort?: Types.TimeEntrySortField | null | undefined;
  order?: Types.SortOrder | null | undefined;
}>;


export type GetTimeEntriesQuery = { timeEntries: { items: Array<{ id: string, startedAt: string, endedAt: string | null, createdAt: string, createdBy: { id: string, name: string, email: string } | null, volunteer: { id: string, name: string, email: string }, shiftInstance: { id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, master: { id: string, title: string } } | null, organizationUnit: { id: string, name: string, organization: { id: string, name: string } } }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type GetTimeEntriesByUserQueryVariables = Exact<{
  userId: string;
  limit: number;
  offset: number;
}>;


export type GetTimeEntriesByUserQuery = { timeEntriesByUser: { items: Array<{ id: string, startedAt: string, endedAt: string | null, shiftInstance: { id: string, actualStartsAt: string, actualEndsAt: string, overrideTitle: string | null, master: { id: string, title: string } } | null, organizationUnit: { id: string, name: string, organization: { id: string, name: string } } }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type GetMyTimeQueryVariables = Exact<{
  limit: number;
  offset: number;
}>;


export type GetMyTimeQuery = { myTime: { items: Array<{ id: string, startedAt: string, endedAt: string | null, shiftInstance: { id: string, overrideTitle: string | null, master: { id: string, title: string, organizationUnit: { id: string, name: string, organization: { id: string, name: string } } } } | null, organizationUnit: { id: string, name: string, organization: { id: string, name: string } } }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type GetCheckInContextQueryVariables = Exact<{
  checkInId: string;
}>;


export type GetCheckInContextQuery = { checkInContext: { volunteer: { id: string, name: string, email: string, image: string | null }, eligibleOrganizationUnits: Array<{ id: string, name: string }>, openTimeEntries: Array<{ id: string, startedAt: string, shiftInstance: { id: string, overrideTitle: string | null, master: { id: string, title: string } } | null, organizationUnit: { id: string, name: string, organization: { id: string, name: string } } }> } | null };

export type GetCheckInReadinessQueryVariables = Exact<{
  volunteerId: string;
  shiftInstanceId?: string | null | undefined;
}>;


export type GetCheckInReadinessQuery = { checkInReadiness: { isMember: boolean, openMembershipRequestId: string | null, shiftInviteStatus: Types.ShiftInviteStatus | null, isParticipating: boolean, hasOpenTimeEntry: boolean, idVerificationEnabled: boolean, idVerified: boolean, membershipId: string | null, agreement: { status: Types.AgreementStatus, reimbursementTypeName: string | null, contractId: string | null, canManageAgreements: boolean, managerNames: Array<string> } } };

export type GetCheckInVolunteerRequiredFormsQueryVariables = Exact<{
  volunteerId: string;
}>;


export type GetCheckInVolunteerRequiredFormsQuery = { checkInVolunteerRequiredForms: Array<{ order: number, submitted: boolean, submissionId: string | null, form: { id: string, name: string } }> };

export type CheckInVolunteerMutationVariables = Exact<{
  volunteerId: string;
  shiftInstanceId?: string | null | undefined;
  startedAt?: string | null | undefined;
}>;


export type CheckInVolunteerMutation = { checkInVolunteer: { id: string } };

export type CheckInInviteToOrganizationMutationVariables = Exact<{
  volunteerId: string;
}>;


export type CheckInInviteToOrganizationMutation = { checkInInviteToOrganization: boolean };

export type CheckOutVolunteerMutationVariables = Exact<{
  timeEntryId: string;
}>;


export type CheckOutVolunteerMutation = { checkOutVolunteer: { id: string } };

export type GetMeQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMeQuery = { me: { id: string, name: string, email: string, image: string | null, checkInId: string, locale: string | null, emailWeeklyUpdateEnabled: boolean, emailUrgentCallsEnabled: boolean, emailPlatformEnabled: boolean, firstname: string, lastname: string, preferredName: string | null, gender: string | null, phone: string | null, street: string | null, zip: string | null, city: string | null, birthdate: string | null, iban: string | null, accountHolder: string | null, bic: string | null } };

export type GetUserQueryVariables = Exact<{
  id: string;
}>;


export type GetUserQuery = { user: { id: string, name: string, email: string, image: string | null, checkInId: string, locale: string | null, firstname: string, lastname: string, preferredName: string | null, gender: string | null, phone: string | null, street: string | null, zip: string | null, city: string | null, birthdate: string | null, iban: string | null, accountHolder: string | null, bic: string | null } | null };

export type GetMyPermissionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMyPermissionsQuery = { me: { id: string, permissions: Array<{ id: string, key: Types.PermissionKey }> | null } };

export type GetMyOrganizationsQueryVariables = Exact<{
  limit: number;
  offset: number;
}>;


export type GetMyOrganizationsQuery = { organizations: { items: Array<{ id: string, name: string, slug: string, description: string | null, logoUrl: string | null }>, pagination: { total: number, limit: number, offset: number, hasMore: boolean } } };

export type UpdateMyLocaleMutationVariables = Exact<{
  locale: string;
}>;


export type UpdateMyLocaleMutation = { updateMyLocale: { id: string, locale: string | null } };

export type UpdateMyImageMutationVariables = Exact<{
  input: Types.UpdateMyImageInput;
}>;


export type UpdateMyImageMutation = { updateMyImage: { id: string, image: string | null } };

export type UpdateMyAccountSettingsMutationVariables = Exact<{
  input: Types.UpdateMyAccountSettingsInput;
}>;


export type UpdateMyAccountSettingsMutation = { updateMyAccountSettings: { id: string, locale: string | null, emailWeeklyUpdateEnabled: boolean, emailUrgentCallsEnabled: boolean, emailPlatformEnabled: boolean } };

export type UnsubscribeFromEmailsMutationVariables = Exact<{ [key: string]: never; }>;


export type UnsubscribeFromEmailsMutation = { unsubscribeFromEmails: boolean };

export type UpdateMyProfileMutationVariables = Exact<{
  input: Types.UpdateMyProfileInput;
}>;


export type UpdateMyProfileMutation = { updateMyProfile: { id: string, firstname: string, lastname: string, preferredName: string | null, gender: string | null, phone: string | null, street: string | null, zip: string | null, city: string | null, birthdate: string | null, iban: string | null, accountHolder: string | null, bic: string | null, email: string } };

export const ContractSummaryFieldsFragmentDoc = gql`
    fragment ContractSummaryFields on Contract {
  id
  contractStatus
  periodStart
  periodEnd
  isNonCompliant
  declineReason
  declinedAt
  declinedAtSigneeType
  declinedByUser {
    id
    name
  }
  renewDate
  downloadUrl
  missingProfileFields
  missingOrgProfileFields
  createdAt
  updatedAt
  volunteer {
    id
    name
    image
  }
  reimbursementType {
    id
    key
  }
  documentTemplate {
    id
    kind
  }
  signatures {
    id
    order
    signeeType
    signedAt
    signedByUser {
      id
      name
    }
    requiredPermission {
      id
      key
    }
  }
  statusChanges {
    id
    type
    occurredAt
    actorUser {
      id
      name
    }
  }
}
    `;
export const InvoiceSummaryFieldsFragmentDoc = gql`
    fragment InvoiceSummaryFields on Invoice {
  id
  invoiceStatus
  periodStart
  periodEnd
  totalAmountCents
  totalHours
  isNonCompliant
  declineReason
  declinedAt
  declinedAtSigneeType
  declinedByUser {
    id
    name
  }
  downloadUrl
  missingProfileFields
  missingOrgProfileFields
  createdAt
  updatedAt
  volunteer {
    id
    name
    image
  }
  reimbursementType {
    id
    key
  }
  documentTemplate {
    id
    kind
  }
  invoiceTimeEntries {
    id
  }
  signatures {
    id
    order
    signeeType
    signedAt
    signedByUser {
      id
      name
    }
    requiredPermission {
      id
      key
    }
  }
  statusChanges {
    id
    type
    occurredAt
    actorUser {
      id
      name
    }
  }
}
    `;
export const DocumentTemplateSummaryFieldsFragmentDoc = gql`
    fragment DocumentTemplateSummaryFields on DocumentTemplate {
  id
  kind
  invoiceNumberFormat
  renewalCadence
  isDeleted
  lastEditedAt
  lastEditedByUser {
    id
    name
  }
  reimbursementType {
    id
    key
  }
  organizationUnit {
    id
    name
  }
  signees {
    id
    order
    signeeType
    requiredPermission {
      id
      key
    }
  }
}
    `;
export const RequiredFormFieldsFragmentDoc = gql`
    fragment RequiredFormFields on RequirementForm {
  id
  name
  description
  settings {
    submitButtonLabel
    successTitle
    successMessage
  }
  blockRefs {
    id
    formId
    blockId
    fieldOrder
    required
    block {
      id
      organizationId
      title
      description
      icon
      required
      isEditable
      fields {
        id
        blockId
        type
        label
        placeholder
        description
        required
        lockType
        systemKey
        options {
          label
          value
        }
        documents {
          fileId
          filename
          downloadUrl
        }
        documentLabel
        minAge
        fieldOrder
      }
    }
  }
}
    `;
export const RequiredFormWithStatusFieldsFragmentDoc = gql`
    fragment RequiredFormWithStatusFields on RequiredFormWithStatus {
  form {
    ...RequiredFormFields
  }
  order
  submitted
  submissionId
  targetType
  targetId
}
    ${RequiredFormFieldsFragmentDoc}`;
export const EventListFieldsFragmentDoc = gql`
    fragment EventListFields on Event {
  id
  title
  slug
  startsAt
  endsAt
  shiftsCount
  requiredFormsCount
  coverUrl
  signedUpCount
}
    `;
export const RequiredFormRefFieldsFragmentDoc = gql`
    fragment RequiredFormRefFields on RequiredFormRef {
  form {
    ...RequiredFormFields
  }
  order
}
    ${RequiredFormFieldsFragmentDoc}`;
export const EventDetailFieldsFragmentDoc = gql`
    fragment EventDetailFields on Event {
  ...EventListFields
  createdAt
  location
  organizer {
    id
    name
    image
  }
  coverUrl
  logoUrl
  requiredForms {
    ...RequiredFormRefFields
  }
}
    ${EventListFieldsFragmentDoc}
${RequiredFormRefFieldsFragmentDoc}`;
export const MyEventFieldsFragmentDoc = gql`
    fragment MyEventFields on Event {
  id
  title
  startsAt
  endsAt
  location
  myInvitedAt
  shiftsCount
  coverUrl
  organizationUnit {
    id
    name
    logoUrl
  }
}
    `;
export const DiscoverEventFieldsFragmentDoc = gql`
    fragment DiscoverEventFields on Event {
  id
  title
  startsAt
  endsAt
  shiftsCount
  coverUrl
  organizationUnit {
    id
    name
    logoUrl
  }
}
    `;
export const PublicEventOrganizationUnitFieldsFragmentDoc = gql`
    fragment PublicEventOrganizationUnitFields on EventOrganizationUnit {
  id
  name
  slug
  logoUrl
  myMembershipState
  requiredForms {
    ...RequiredFormRefFields
  }
}
    ${RequiredFormRefFieldsFragmentDoc}`;
export const PublicShiftInstanceFieldsFragmentDoc = gql`
    fragment PublicShiftInstanceFields on ShiftInstance {
  id
  actualStartsAt
  actualEndsAt
  overrideTitle
  overrideMaxVolunteers
  filledCount
  spotsLeft
}
    `;
export const PublicShiftFieldsFragmentDoc = gql`
    fragment PublicShiftFields on Shift {
  id
  title
  maxVolunteers
  instances {
    ...PublicShiftInstanceFields
  }
}
    ${PublicShiftInstanceFieldsFragmentDoc}`;
export const PublicEventFieldsFragmentDoc = gql`
    fragment PublicEventFields on Event {
  id
  title
  slug
  description
  location
  coverImageUrl
  startsAt
  endsAt
  shiftsCount
  myJoinStatus
  myInviteStatus
  organizationUnit {
    ...PublicEventOrganizationUnitFields
  }
  shifts {
    ...PublicShiftFields
  }
  requiredForms {
    ...RequiredFormRefFields
  }
}
    ${PublicEventOrganizationUnitFieldsFragmentDoc}
${PublicShiftFieldsFragmentDoc}
${RequiredFormRefFieldsFragmentDoc}`;
export const OrganizationUnitAutomationFieldsFragmentDoc = gql`
    fragment OrganizationUnitAutomationFields on OrganizationUnitAutomation {
  organizationUnitId
  kind
  enabled
  activeDays
  leadTimeHours
  sendAtTime
}
    `;
export const PublicOrganizationUnitFieldsFragmentDoc = gql`
    fragment PublicOrganizationUnitFields on OrganizationUnit {
  id
  name
  slug
  description
  logoUrl
  coverUrl
  street
  zipCode
  city
  memberCount
  openShiftsCount
  myMembershipState
}
    `;
export const PublicOrgEventFieldsFragmentDoc = gql`
    fragment PublicOrgEventFields on Event {
  id
  title
  slug
  startsAt
  endsAt
  location
  shiftsCount
  shifts {
    id
    instances {
      id
      spotsLeft
    }
  }
}
    `;
export const PublicOrgShiftInstanceFieldsFragmentDoc = gql`
    fragment PublicOrgShiftInstanceFields on ShiftInstance {
  id
  actualStartsAt
  actualEndsAt
  overrideMaxVolunteers
  filledCount
  spotsLeft
}
    `;
export const PublicOrgShiftFieldsFragmentDoc = gql`
    fragment PublicOrgShiftFields on Shift {
  id
  title
  maxVolunteers
  rrule
  originalStartsAt
  durationMinutes
  instances {
    ...PublicOrgShiftInstanceFields
  }
}
    ${PublicOrgShiftInstanceFieldsFragmentDoc}`;
export const PublicShiftDetailInstanceFieldsFragmentDoc = gql`
    fragment PublicShiftDetailInstanceFields on ShiftInstance {
  id
  actualStartsAt
  actualEndsAt
  overrideTitle
  overrideMaxVolunteers
  reimbursementTypeKey
  overrideJoinRequiresApproval
  filledCount
  spotsLeft
  myInviteStatus
  isIntendingToJoin
  requiredFormsCount
  requiredForms {
    ...RequiredFormRefFields
  }
}
    ${RequiredFormRefFieldsFragmentDoc}`;
export const VolunteerHomeShiftInstanceFragmentDoc = gql`
    fragment VolunteerHomeShiftInstance on ShiftInstance {
  id
  overrideTitle
  actualStartsAt
  actualEndsAt
  isCheckedIn
  reimbursementTypeKey
  filledCount
  spotsLeft
  myInviteStatus
  myInvitedAt
  isIntendingToJoin
  master {
    id
    title
    location
    rrule
    maxVolunteers
    organizationUnit {
      id
      name
      logoUrl
    }
    event {
      id
      title
      coverImageUrl
    }
  }
}
    `;
export const GetReimbursementTypesDocument = gql`
    query GetReimbursementTypes {
  reimbursementTypes {
    id
    key
    legalReference
    yearlyLimitCents
    platformDefaultRateCents
  }
}
    `;
export const GetEffectiveRatesDocument = gql`
    query GetEffectiveRates($organizationUnitId: ID) {
  effectiveRates(organizationUnitId: $organizationUnitId) {
    reimbursementType {
      id
      key
      legalReference
      yearlyLimitCents
      platformDefaultRateCents
    }
    hourlyRateCents
    isOverride
    organizationUnitId
    provenance {
      kind
      sourceName
      replacesRateCents
    }
  }
}
    `;
export const SetReimbursementRateDocument = gql`
    mutation SetReimbursementRate($reimbursementTypeId: ID!, $hourlyRateCents: Int!, $organizationUnitId: ID) {
  setReimbursementRate(
    reimbursementTypeId: $reimbursementTypeId
    hourlyRateCents: $hourlyRateCents
    organizationUnitId: $organizationUnitId
  ) {
    id
    hourlyRateCents
  }
}
    `;
export const GetYearlyUsageDocument = gql`
    query GetYearlyUsage($volunteerId: ID!, $reimbursementTypeId: ID!, $year: Int!, $asOfDate: DateTime, $excludeInvoiceId: ID) {
  yearlyUsage(
    volunteerId: $volunteerId
    reimbursementTypeId: $reimbursementTypeId
    year: $year
    asOfDate: $asOfDate
    excludeInvoiceId: $excludeInvoiceId
  ) {
    usedCents
    limitCents
    remainingCents
  }
}
    `;
export const GetVolunteerAllowanceStatesDocument = gql`
    query GetVolunteerAllowanceStates($volunteerIds: [ID!]!, $shiftInstanceId: ID) {
  volunteerAllowanceStates(
    volunteerIds: $volunteerIds
    shiftInstanceId: $shiftInstanceId
  ) {
    volunteerId
    state
  }
}
    `;
export const GetRosterYearlyUsageDocument = gql`
    query GetRosterYearlyUsage($organizationUnitId: ID!, $year: Int!) {
  rosterYearlyUsage(organizationUnitId: $organizationUnitId, year: $year) {
    volunteer {
      id
      name
      image
    }
    usageByType {
      reimbursementType {
        id
        key
      }
      usedCents
      limitCents
      remainingCents
    }
  }
}
    `;
export const GetContractsDocument = gql`
    query GetContracts($filter: ContractFilterInput) {
  contracts(filter: $filter) {
    ...ContractSummaryFields
  }
}
    ${ContractSummaryFieldsFragmentDoc}`;
export const GetMyContractsDocument = gql`
    query GetMyContracts($filter: ContractFilterInput) {
  myContracts(filter: $filter) {
    ...ContractSummaryFields
  }
}
    ${ContractSummaryFieldsFragmentDoc}`;
export const GetContractDocument = gql`
    query GetContract($id: ID!) {
  contract(id: $id) {
    ...ContractSummaryFields
    resolvedBody
  }
}
    ${ContractSummaryFieldsFragmentDoc}`;
export const GetPendingContractSigneeDocument = gql`
    query GetPendingContractSignee($contractId: ID!) {
  pendingContractSignee(contractId: $contractId) {
    signeeType
    userId
    permissionKey
    eligibleUserIds
  }
}
    `;
export const CreateContractDocument = gql`
    mutation CreateContract($input: CreateContractInput!) {
  createContract(input: $input) {
    ...ContractSummaryFields
  }
}
    ${ContractSummaryFieldsFragmentDoc}`;
export const SignContractDocument = gql`
    mutation SignContract($contractId: ID!) {
  signContract(contractId: $contractId) {
    ...ContractSummaryFields
  }
}
    ${ContractSummaryFieldsFragmentDoc}`;
export const DeclineContractDocument = gql`
    mutation DeclineContract($contractId: ID!, $reason: String!) {
  declineContract(contractId: $contractId, reason: $reason) {
    ...ContractSummaryFields
  }
}
    ${ContractSummaryFieldsFragmentDoc}`;
export const GetInvoicesDocument = gql`
    query GetInvoices($filter: InvoiceFilterInput) {
  invoices(filter: $filter) {
    ...InvoiceSummaryFields
  }
}
    ${InvoiceSummaryFieldsFragmentDoc}`;
export const GetMyInvoicesDocument = gql`
    query GetMyInvoices($filter: InvoiceFilterInput) {
  myInvoices(filter: $filter) {
    ...InvoiceSummaryFields
  }
}
    ${InvoiceSummaryFieldsFragmentDoc}`;
export const GetInvoiceDocument = gql`
    query GetInvoice($id: ID!) {
  invoice(id: $id) {
    ...InvoiceSummaryFields
    resolvedBody
    invoiceTimeEntries {
      id
      timeEntry {
        id
        startedAt
        endedAt
        notes
        shiftInstance {
          id
          overrideTitle
          master {
            title
          }
        }
      }
    }
  }
}
    ${InvoiceSummaryFieldsFragmentDoc}`;
export const GetPendingInvoiceSigneeDocument = gql`
    query GetPendingInvoiceSignee($invoiceId: ID!) {
  pendingInvoiceSignee(invoiceId: $invoiceId) {
    signeeType
    userId
    permissionKey
    eligibleUserIds
  }
}
    `;
export const GetVolunteersNeedingTimesheetsDocument = gql`
    query GetVolunteersNeedingTimesheets($periodStart: DateTime, $periodEnd: DateTime) {
  volunteersNeedingTimesheets(periodStart: $periodStart, periodEnd: $periodEnd) {
    volunteer {
      id
      name
    }
    reimbursementType {
      id
      key
    }
    periodStart
    periodEnd
    eligibleHours
    estimatedAmountCents
  }
}
    `;
export const GetPaidShiftSignupVolunteersDocument = gql`
    query GetPaidShiftSignupVolunteers($year: Int!) {
  paidShiftSignupVolunteers(year: $year) {
    volunteer {
      id
      name
    }
    reimbursementType {
      id
      key
    }
    periodStart
    periodEnd
  }
}
    `;
export const GetEligibleTimeEntriesForInvoiceDocument = gql`
    query GetEligibleTimeEntriesForInvoice($volunteerId: ID!, $reimbursementTypeId: ID!, $periodStart: DateTime, $periodEnd: DateTime) {
  eligibleTimeEntriesForInvoice(
    volunteerId: $volunteerId
    reimbursementTypeId: $reimbursementTypeId
    periodStart: $periodStart
    periodEnd: $periodEnd
  ) {
    id
    startedAt
    endedAt
    notes
    shiftInstance {
      id
      overrideTitle
      master {
        title
      }
    }
  }
}
    `;
export const CreateInvoiceDocument = gql`
    mutation CreateInvoice($input: CreateInvoiceInput!) {
  createInvoice(input: $input) {
    ...InvoiceSummaryFields
  }
}
    ${InvoiceSummaryFieldsFragmentDoc}`;
export const SignInvoiceDocument = gql`
    mutation SignInvoice($invoiceId: ID!) {
  signInvoice(invoiceId: $invoiceId) {
    ...InvoiceSummaryFields
  }
}
    ${InvoiceSummaryFieldsFragmentDoc}`;
export const DeclineInvoiceDocument = gql`
    mutation DeclineInvoice($invoiceId: ID!, $reason: String!) {
  declineInvoice(invoiceId: $invoiceId, reason: $reason) {
    ...InvoiceSummaryFields
  }
}
    ${InvoiceSummaryFieldsFragmentDoc}`;
export const GetDocumentTemplatesDocument = gql`
    query GetDocumentTemplates {
  documentTemplates {
    ...DocumentTemplateSummaryFields
  }
}
    ${DocumentTemplateSummaryFieldsFragmentDoc}`;
export const GetDocumentTemplateDocument = gql`
    query GetDocumentTemplate($id: ID!) {
  documentTemplate(id: $id) {
    ...DocumentTemplateSummaryFields
    body
  }
}
    ${DocumentTemplateSummaryFieldsFragmentDoc}`;
export const GetActiveDocumentTemplateDocument = gql`
    query GetActiveDocumentTemplate($kind: DocumentKind!, $reimbursementTypeId: ID!, $organizationUnitId: ID) {
  activeDocumentTemplate(
    kind: $kind
    reimbursementTypeId: $reimbursementTypeId
    organizationUnitId: $organizationUnitId
  ) {
    ...DocumentTemplateSummaryFields
    body
  }
}
    ${DocumentTemplateSummaryFieldsFragmentDoc}`;
export const CreateDocumentTemplateDocument = gql`
    mutation CreateDocumentTemplate($input: CreateDocumentTemplateInput!) {
  createDocumentTemplate(input: $input) {
    ...DocumentTemplateSummaryFields
  }
}
    ${DocumentTemplateSummaryFieldsFragmentDoc}`;
export const UpdateDocumentTemplateDocument = gql`
    mutation UpdateDocumentTemplate($id: ID!, $input: UpdateDocumentTemplateInput!) {
  updateDocumentTemplate(id: $id, input: $input) {
    ...DocumentTemplateSummaryFields
  }
}
    ${DocumentTemplateSummaryFieldsFragmentDoc}`;
export const DeleteDocumentTemplateDocument = gql`
    mutation DeleteDocumentTemplate($id: ID!) {
  deleteDocumentTemplate(id: $id)
}
    `;
export const GetBundleDownloadStatusDocument = gql`
    query GetBundleDownloadStatus($volunteerId: ID!, $reimbursementTypeId: ID!) {
  bundleDownloadStatus(
    volunteerId: $volunteerId
    reimbursementTypeId: $reimbursementTypeId
  ) {
    volunteer {
      id
      name
    }
    reimbursementType {
      id
      key
    }
    downloadedAt
    downloadedByUser {
      id
      name
    }
  }
}
    `;
export const RecordBundleDownloadDocument = gql`
    mutation RecordBundleDownload($volunteerId: ID!, $reimbursementTypeId: ID!, $invoiceIds: [ID!]) {
  recordBundleDownload(
    volunteerId: $volunteerId
    reimbursementTypeId: $reimbursementTypeId
    invoiceIds: $invoiceIds
  ) {
    volunteer {
      id
      name
    }
    reimbursementType {
      id
      key
    }
    downloadedAt
    downloadedByUser {
      id
      name
    }
  }
}
    `;
export const GetManualBaselineDocument = gql`
    query GetManualBaseline($volunteerId: ID!, $reimbursementTypeId: ID!, $year: Int!) {
  manualBaseline(
    volunteerId: $volunteerId
    reimbursementTypeId: $reimbursementTypeId
    year: $year
  ) {
    volunteer {
      id
      name
    }
    reimbursementType {
      id
      key
    }
    year
    amountCents
    updatedAt
    updatedByUser {
      id
      name
    }
  }
}
    `;
export const SetManualBaselineDocument = gql`
    mutation SetManualBaseline($volunteerId: ID!, $reimbursementTypeId: ID!, $year: Int!, $amountCents: Int!) {
  setManualBaseline(
    volunteerId: $volunteerId
    reimbursementTypeId: $reimbursementTypeId
    year: $year
    amountCents: $amountCents
  ) {
    volunteer {
      id
      name
    }
    reimbursementType {
      id
      key
    }
    year
    amountCents
    updatedAt
    updatedByUser {
      id
      name
    }
  }
}
    `;
export const MyDocumentsDocument = gql`
    query MyDocuments {
  myDocuments {
    membershipId
    organizationUnitId
    organizationUnitName
    organizationName
    logoUrl
    contracts {
      ...ContractSummaryFields
    }
    invoices {
      ...InvoiceSummaryFields
    }
  }
}
    ${ContractSummaryFieldsFragmentDoc}
${InvoiceSummaryFieldsFragmentDoc}`;
export const MyDocumentSummaryDocument = gql`
    query MyDocumentSummary {
  myDocumentSummary {
    total
    pending
  }
}
    `;
export const GetAccountingSetupStatusDocument = gql`
    query GetAccountingSetupStatus {
  accountingSetupStatus {
    orgProfile {
      name
      street
      zipCode
      city
      legalRep
    }
    orgProfileComplete
    missingOrgProfileFields
    canCreateDocuments
    slots {
      reimbursementTypeId
      reimbursementTypeKey
      hasContractTemplate
      hasInvoiceTemplate
      ready
    }
  }
}
    `;
export const GetEventsDocument = gql`
    query GetEvents($limit: Int!, $offset: Int!) {
  events(limit: $limit, offset: $offset) {
    items {
      ...EventListFields
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    ${EventListFieldsFragmentDoc}`;
export const GetMyEventsDocument = gql`
    query GetMyEvents($includePast: Boolean = false, $startsAfter: DateTime, $endsBefore: DateTime, $limit: Int = 15, $offset: Int = 0, $order: SortOrder = ASC, $statuses: [EventInviteStatus!]) {
  myEvents(
    includePast: $includePast
    startsAfter: $startsAfter
    endsBefore: $endsBefore
    limit: $limit
    offset: $offset
    order: $order
    statuses: $statuses
  ) {
    items {
      ...MyEventFields
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    ${MyEventFieldsFragmentDoc}`;
export const GetAvailableEventsDocument = gql`
    query GetAvailableEvents($startsAfter: DateTime, $endsBefore: DateTime, $limit: Int = 15, $offset: Int = 0, $organizationUnitIds: [ID!]) {
  availableEvents(
    startsAfter: $startsAfter
    endsBefore: $endsBefore
    limit: $limit
    offset: $offset
    organizationUnitIds: $organizationUnitIds
  ) {
    items {
      ...DiscoverEventFields
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    ${DiscoverEventFieldsFragmentDoc}`;
export const GetEventDocument = gql`
    query GetEvent($id: ID!) {
  event(id: $id) {
    ...EventDetailFields
  }
}
    ${EventDetailFieldsFragmentDoc}`;
export const GetEventInvitesDocument = gql`
    query GetEventInvites($eventId: ID!) {
  eventInvites(eventId: $eventId) {
    id
    status
    user {
      id
      name
      email
      image
      checkInId
    }
  }
}
    `;
export const CreateEventDocument = gql`
    mutation CreateEvent($input: CreateEventInput!) {
  createEvent(input: $input) {
    ...EventDetailFields
  }
}
    ${EventDetailFieldsFragmentDoc}`;
export const UpdateEventDocument = gql`
    mutation UpdateEvent($id: ID!, $input: UpdateEventInput!) {
  updateEvent(id: $id, input: $input) {
    ...EventDetailFields
  }
}
    ${EventDetailFieldsFragmentDoc}`;
export const DeleteEventDocument = gql`
    mutation DeleteEvent($id: ID!) {
  deleteEvent(id: $id) {
    id
  }
}
    `;
export const InviteMembersToEventDocument = gql`
    mutation InviteMembersToEvent($eventId: ID!, $memberIds: [String!]!) {
  inviteMembersToEvent(eventId: $eventId, memberIds: $memberIds) {
    id
  }
}
    `;
export const UpdateEventInviteStatusDocument = gql`
    mutation UpdateEventInviteStatus($eventId: ID!, $status: EventInviteStatus!, $userId: String) {
  updateEventInviteStatus(eventId: $eventId, status: $status, userId: $userId) {
    id
    status
    userId
  }
}
    `;
export const GetPublicEventDocument = gql`
    query GetPublicEvent($id: ID!) {
  publicEvent(id: $id) {
    ...PublicEventFields
  }
}
    ${PublicEventFieldsFragmentDoc}`;
export const JoinEventDocument = gql`
    mutation JoinEvent($eventId: ID!) {
  joinEvent(eventId: $eventId) {
    status
    event {
      id
    }
    requiredForms {
      ...RequiredFormWithStatusFields
    }
  }
}
    ${RequiredFormWithStatusFieldsFragmentDoc}`;
export const SetEventRequiredFormsDocument = gql`
    mutation SetEventRequiredForms($eventId: ID!, $formIds: [String!]!) {
  setEventRequiredForms(eventId: $eventId, formIds: $formIds) {
    ...RequiredFormRefFields
  }
}
    ${RequiredFormRefFieldsFragmentDoc}`;
export const GetOrganizationUnitMembershipsDocument = gql`
    query GetOrganizationUnitMemberships {
  memberships {
    id
    user {
      id
      name
      email
      image
      checkInId
    }
    organizationUnit {
      id
      name
    }
    roles {
      id
      name
      description
      isInternal
    }
    idVerifiedAt
    idVerifiedBy {
      id
      name
    }
  }
}
    `;
export const GetMyMembershipStatusDocument = gql`
    query GetMyMembershipStatus($organizationUnitId: ID!) {
  myMembershipStatus(organizationUnitId: $organizationUnitId)
}
    `;
export const UpdateMembershipRolesDocument = gql`
    mutation UpdateMembershipRoles($membershipId: ID!, $roleIds: [ID!]!) {
  updateMembershipRoles(membershipId: $membershipId, roleIds: $roleIds) {
    id
    user {
      id
      name
      email
      image
      checkInId
    }
    organizationUnit {
      id
      name
    }
    roles {
      id
      name
      description
      isInternal
    }
  }
}
    `;
export const LeaveMembershipDocument = gql`
    mutation LeaveMembership($id: ID!) {
  leaveMembership(id: $id) {
    id
  }
}
    `;
export const RemoveMembershipDocument = gql`
    mutation RemoveMembership($id: ID!) {
  removeMembership(id: $id) {
    id
  }
}
    `;
export const MyMembershipsDocument = gql`
    query MyMemberships {
  myMemberships {
    id
    createdAt
    organizationUnit {
      id
      name
      logoUrl
      type {
        icon
      }
      parent {
        id
      }
      organization {
        name
      }
    }
    roles {
      id
      name
      isInternal
    }
  }
}
    `;
export const MyMembershipDocument = gql`
    query MyMembership($id: ID!) {
  myMembership(id: $id) {
    id
    createdAt
    organizationUnit {
      id
      name
      logoUrl
      type {
        icon
      }
      parent {
        id
      }
      organization {
        name
      }
    }
    roles {
      id
      name
      isInternal
    }
  }
}
    `;
export const SetMembershipIdVerifiedDocument = gql`
    mutation SetMembershipIdVerified($membershipId: ID!, $verified: Boolean!) {
  setMembershipIdVerified(membershipId: $membershipId, verified: $verified) {
    id
    idVerifiedAt
  }
}
    `;
export const JoinOrganizationDocument = gql`
    mutation JoinOrganization($organizationUnitId: ID!) {
  joinOrganization(organizationUnitId: $organizationUnitId) {
    status
    membershipRequestId
    requirementProfile {
      id
      name
      description
      requirements {
        id
        name
        description
        type
        mandatory
      }
    }
    requirementStatuses {
      requirementId
      name
      status
    }
    requiredForms {
      form {
        id
        name
        description
      }
      order
      submitted
      submissionId
    }
  }
}
    `;
export const ApproveMembershipRequestDocument = gql`
    mutation ApproveMembershipRequest($id: ID!, $organizationUnitId: ID!) {
  approveMembershipRequest(id: $id, organizationUnitId: $organizationUnitId) {
    id
  }
}
    `;
export const RejectMembershipRequestDocument = gql`
    mutation RejectMembershipRequest($id: ID!, $organizationUnitId: ID!, $rejectionReason: String!) {
  rejectMembershipRequest(
    id: $id
    organizationUnitId: $organizationUnitId
    rejectionReason: $rejectionReason
  ) {
    id
  }
}
    `;
export const CancelMembershipRequestDocument = gql`
    mutation CancelMembershipRequest($id: ID!, $organizationUnitId: ID!) {
  cancelMembershipRequest(id: $id, organizationUnitId: $organizationUnitId) {
    id
  }
}
    `;
export const RemoveMembershipRequestDocument = gql`
    mutation RemoveMembershipRequest($id: ID!) {
  removeMembershipRequest(id: $id) {
    id
  }
}
    `;
export const GetMembershipRequestsDocument = gql`
    query GetMembershipRequests($status: MembershipRequestStatus, $limit: Int!, $offset: Int!) {
  membershipRequests(status: $status, limit: $limit, offset: $offset) {
    items {
      id
      organizationUnit {
        id
        name
      }
      user {
        id
        name
        email
        image
        checkInId
      }
      status
      reviewedBy {
        id
        name
      }
      reviewedAt
      rejectionReason
      createdAt
      updatedAt
    }
  }
}
    `;
export const GetMembershipRequestCountDocument = gql`
    query GetMembershipRequestCount($status: MembershipRequestStatus) {
  membershipRequestCount(status: $status)
}
    `;
export const GetMyMembershipRequestsDocument = gql`
    query GetMyMembershipRequests($limit: Int!, $offset: Int!) {
  myMembershipRequests(limit: $limit, offset: $offset) {
    items {
      id
      organizationUnit {
        id
        name
        logoUrl
        type {
          icon
        }
        parent {
          id
        }
        organization {
          name
        }
      }
      user {
        id
        name
        email
      }
      contact {
        name
        email
        phone
      }
      status
      reviewedAt
      rejectionReason
      createdAt
    }
  }
}
    `;
export const CheckInApproveMembershipRequestDocument = gql`
    mutation CheckInApproveMembershipRequest($requestId: ID!) {
  checkInApproveMembershipRequest(requestId: $requestId) {
    id
    status
  }
}
    `;
export const GetOrganizationDocument = gql`
    query GetOrganization($id: String!) {
  organization(id: $id) {
    id
    name
    slug
    description
    logoUrl
    websiteUrl
    contactEmail
    phone
    street
    zipCode
    city
    createdAt
    updatedAt
  }
}
    `;
export const GetOrganizationBySlugDocument = gql`
    query GetOrganizationBySlug($slug: String!) {
  organizationBySlug(slug: $slug) {
    id
    name
    slug
    description
    logoUrl
    websiteUrl
    contactEmail
    phone
    street
    zipCode
    city
    createdAt
  }
}
    `;
export const GetOrganizationRootDocument = gql`
    query GetOrganizationRoot($id: String!) {
  organization(id: $id) {
    id
    root {
      id
    }
  }
}
    `;
export const GetOrganizationUnitDocument = gql`
    query GetOrganizationUnit($id: String!) {
  organizationUnit(id: $id) {
    id
    slug
    name
    description
    logoUrl
    websiteUrl
    contactEmail
    contactPersonName
    phone
    welcomeMessage
    street
    zipCode
    city
    legalRep
    idVerificationEnabled
    organizationId
    organization {
      id
      name
    }
    requiredForms {
      form {
        id
        name
        description
        settings {
          submitButtonLabel
          successTitle
          successMessage
        }
        blockRefs {
          id
          formId
          blockId
          fieldOrder
          required
          block {
            id
            organizationId
            title
            description
            icon
            required
            isEditable
            fields {
              id
              blockId
              type
              label
              placeholder
              description
              required
              lockType
              systemKey
              options {
                label
                value
              }
              documents {
                fileId
                filename
                downloadUrl
              }
              documentLabel
              minAge
              fieldOrder
            }
          }
        }
      }
      order
    }
    parent {
      id
      name
    }
    type {
      id
      name
      icon
    }
  }
}
    `;
export const GetOrganizationVolunteersByUnitDocument = gql`
    query GetOrganizationVolunteersByUnit($id: ID!) {
  members(organizationUnitId: $id) {
    id
    name
    email
    image
    checkInId
  }
}
    `;
export const GetOrganizationUnitWithOrgDocument = gql`
    query GetOrganizationUnitWithOrg($id: String!) {
  organizationUnit(id: $id) {
    id
    name
    organization {
      name
    }
  }
}
    `;
export const GetOrganizationUnitPublicInfoDocument = gql`
    query GetOrganizationUnitPublicInfo($id: String!) {
  organizationUnit(id: $id) {
    id
    name
    description
    logoUrl
    websiteUrl
    contactEmail
    phone
  }
}
    `;
export const GetOrganizationsWithRootDocument = gql`
    query GetOrganizationsWithRoot($limit: Int!, $offset: Int!) {
  organizations(limit: $limit, offset: $offset) {
    items {
      id
      name
      description
      logoUrl
      root {
        id
        slug
        name
        description
        logoUrl
        street
        zipCode
        city
      }
    }
  }
}
    `;
export const GetMyOrganizationUnitsDocument = gql`
    query GetMyOrganizationUnits {
  myOrganizationUnits {
    id
    slug
    name
    description
    logoUrl
    street
    zipCode
    city
    legalRep
    parent {
      id
    }
    organization {
      id
      name
      description
      logoUrl
      accountingEnabled
    }
  }
}
    `;
export const GetMyAdminstableOrganizationUnitsDocument = gql`
    query GetMyAdminstableOrganizationUnits {
  myAdminstableOrganizationUnits {
    id
    slug
    name
    description
    logoUrl
    street
    zipCode
    city
    legalRep
    parent {
      id
    }
    organization {
      id
      name
      description
      logoUrl
      accountingEnabled
    }
  }
}
    `;
export const GetMyCheckInAdministrableOrganizationUnitsDocument = gql`
    query GetMyCheckInAdministrableOrganizationUnits {
  myCheckInAdministrableOrganizationUnits {
    id
    slug
    name
    description
    logoUrl
    street
    zipCode
    city
    legalRep
    parent {
      id
    }
    organization {
      id
      name
      description
      logoUrl
      accountingEnabled
    }
  }
}
    `;
export const GetOrganizationsDocument = gql`
    query GetOrganizations($limit: Int!, $offset: Int!) {
  organizations(limit: $limit, offset: $offset) {
    items {
      id
      name
      slug
      description
      logoUrl
      createdAt
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    `;
export const CreateOrganizationDocument = gql`
    mutation CreateOrganization($input: CreateOrganizationInput!) {
  createOrganization(input: $input) {
    id
    name
    slug
    description
    logoUrl
    websiteUrl
    createdAt
    root {
      id
    }
  }
}
    `;
export const UpdateOrganizationDocument = gql`
    mutation UpdateOrganization($id: ID!, $input: UpdateOrganizationInput!) {
  updateOrganization(id: $id, input: $input) {
    id
    name
    street
    zipCode
    city
  }
}
    `;
export const GetOrganizationTreeDocument = gql`
    query GetOrganizationTree {
  organizationTree {
    root
  }
}
    `;
export const GetOrganizationUnitTypesDocument = gql`
    query GetOrganizationUnitTypes {
  organizationUnitTypes {
    id
    name
    description
    icon
  }
}
    `;
export const CreateOrganizationUnitDocument = gql`
    mutation CreateOrganizationUnit($input: CreateOrganizationUnitInput!) {
  createOrganizationUnit(input: $input) {
    id
    name
    slug
    deletedAt
    parent {
      id
      name
    }
    type {
      id
      name
      icon
    }
  }
}
    `;
export const UpdateOrganizationUnitDocument = gql`
    mutation UpdateOrganizationUnit($id: String!, $input: UpdateOrganizationUnitInput!) {
  updateOrganizationUnit(id: $id, input: $input) {
    id
    name
    slug
    deletedAt
    street
    zipCode
    city
    legalRep
    idVerificationEnabled
    parent {
      id
    }
    type {
      id
      name
      icon
    }
  }
}
    `;
export const RequestOrganizationUnitDeletionDocument = gql`
    mutation RequestOrganizationUnitDeletion($id: String!, $message: String) {
  requestOrganizationUnitDeletion(id: $id, message: $message) {
    id
    name
  }
}
    `;
export const IsMemberOfOrgUnitOrAncestorDocument = gql`
    query IsMemberOfOrgUnitOrAncestor($organizationUnitId: ID!, $userId: String!) {
  isMemberOfUnitOrAncestor(
    organizationUnitId: $organizationUnitId
    userId: $userId
  )
}
    `;
export const SetRequiredFormsDocument = gql`
    mutation SetRequiredForms($organizationUnitId: String!, $formIds: [String!]!) {
  setRequiredForms(organizationUnitId: $organizationUnitId, formIds: $formIds) {
    form {
      id
      name
      description
    }
    order
  }
}
    `;
export const GetOrganizationUnitAutomationsDocument = gql`
    query GetOrganizationUnitAutomations($organizationUnitId: ID!) {
  organizationUnitAutomations(organizationUnitId: $organizationUnitId) {
    ...OrganizationUnitAutomationFields
  }
}
    ${OrganizationUnitAutomationFieldsFragmentDoc}`;
export const UpdateOrganizationUnitAutomationDocument = gql`
    mutation UpdateOrganizationUnitAutomation($organizationUnitId: ID!, $kind: OrganizationUnitAutomationKind!, $input: UpdateOrganizationUnitAutomationInput!) {
  updateOrganizationUnitAutomation(
    organizationUnitId: $organizationUnitId
    kind: $kind
    input: $input
  ) {
    ...OrganizationUnitAutomationFields
  }
}
    ${OrganizationUnitAutomationFieldsFragmentDoc}`;
export const GetPublicOrganizationUnitDocument = gql`
    query GetPublicOrganizationUnit($id: ID!) {
  publicOrganizationUnit(id: $id) {
    ...PublicOrganizationUnitFields
  }
}
    ${PublicOrganizationUnitFieldsFragmentDoc}`;
export const GetPublicEventsByOrganizationUnitDocument = gql`
    query GetPublicEventsByOrganizationUnit($organizationUnitId: ID!) {
  publicEventsByOrganizationUnit(organizationUnitId: $organizationUnitId) {
    ...PublicOrgEventFields
  }
}
    ${PublicOrgEventFieldsFragmentDoc}`;
export const GetPublicShiftsByOrganizationUnitDocument = gql`
    query GetPublicShiftsByOrganizationUnit($organizationUnitId: ID!) {
  publicShiftsByOrganizationUnit(organizationUnitId: $organizationUnitId) {
    ...PublicOrgShiftFields
  }
}
    ${PublicOrgShiftFieldsFragmentDoc}`;
export const GetFormBlockDocument = gql`
    query GetFormBlock($id: String!) {
  formBlock(id: $id) {
    id
    organizationId
    title
    description
    icon
    required
    isEditable
    createdBy
    updatedBy
    createdAt
    updatedAt
    fields {
      id
      blockId
      type
      label
      placeholder
      description
      required
      lockType
      systemKey
      options {
        label
        value
      }
      documents {
        fileId
        filename
        downloadUrl
      }
      documentLabel
      minAge
      fieldOrder
      createdAt
      updatedAt
    }
  }
}
    `;
export const GetFormBlocksDocument = gql`
    query GetFormBlocks($organizationId: String!, $limit: Int!, $offset: Int!) {
  formBlocks(organizationId: $organizationId, limit: $limit, offset: $offset) {
    items {
      id
      organizationId
      title
      description
      icon
      required
      isEditable
      createdBy
      updatedBy
      createdAt
      updatedAt
      fields {
        id
        blockId
        type
        label
        placeholder
        description
        required
        lockType
        systemKey
        options {
          label
          value
        }
        documents {
          fileId
          filename
          downloadUrl
        }
        documentLabel
        minAge
        fieldOrder
        createdAt
        updatedAt
      }
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    `;
export const CreateFormBlockDocument = gql`
    mutation CreateFormBlock($input: CreateFormBlockInput!) {
  createFormBlock(input: $input) {
    id
    organizationId
    title
    description
    icon
    required
    isEditable
    createdBy
    updatedBy
    createdAt
    updatedAt
    fields {
      id
      blockId
      type
      label
      placeholder
      description
      required
      lockType
      systemKey
      options {
        label
        value
      }
      documents {
        fileId
        filename
        downloadUrl
      }
      documentLabel
      minAge
      fieldOrder
      createdAt
      updatedAt
    }
  }
}
    `;
export const UpdateFormBlockDocument = gql`
    mutation UpdateFormBlock($id: String!, $input: UpdateFormBlockInput!) {
  updateFormBlock(id: $id, input: $input) {
    id
    organizationId
    title
    description
    icon
    required
    isEditable
    createdBy
    updatedBy
    createdAt
    updatedAt
    fields {
      id
      blockId
      type
      label
      placeholder
      description
      required
      lockType
      systemKey
      options {
        label
        value
      }
      documents {
        fileId
        filename
        downloadUrl
      }
      documentLabel
      minAge
      fieldOrder
      createdAt
      updatedAt
    }
  }
}
    `;
export const DeleteFormBlockDocument = gql`
    mutation DeleteFormBlock($id: String!) {
  deleteFormBlock(id: $id) {
    id
  }
}
    `;
export const CreateFormBlockFieldDocument = gql`
    mutation CreateFormBlockField($blockId: String!, $input: CreateFormBlockFieldInput!) {
  createFormBlockField(blockId: $blockId, input: $input) {
    id
    organizationId
    title
    description
    icon
    required
    isEditable
    createdBy
    updatedBy
    createdAt
    updatedAt
    fields {
      id
      blockId
      type
      label
      placeholder
      description
      required
      lockType
      systemKey
      options {
        label
        value
      }
      documents {
        fileId
        filename
        downloadUrl
      }
      documentLabel
      minAge
      fieldOrder
      createdAt
      updatedAt
    }
  }
}
    `;
export const UpdateFormBlockFieldDocument = gql`
    mutation UpdateFormBlockField($fieldId: String!, $input: UpdateFormBlockFieldInput!) {
  updateFormBlockField(fieldId: $fieldId, input: $input) {
    id
    organizationId
    title
    description
    icon
    required
    isEditable
    createdBy
    updatedBy
    createdAt
    updatedAt
    fields {
      id
      blockId
      type
      label
      placeholder
      description
      required
      lockType
      systemKey
      options {
        label
        value
      }
      documents {
        fileId
        filename
        downloadUrl
      }
      documentLabel
      minAge
      fieldOrder
      createdAt
      updatedAt
    }
  }
}
    `;
export const DeleteFormBlockFieldDocument = gql`
    mutation DeleteFormBlockField($fieldId: String!) {
  deleteFormBlockField(fieldId: $fieldId) {
    id
    organizationId
    title
    description
    icon
    required
    isEditable
    createdBy
    updatedBy
    createdAt
    updatedAt
    fields {
      id
      blockId
      type
      label
      placeholder
      description
      required
      lockType
      systemKey
      options {
        label
        value
      }
      documents {
        fileId
        filename
        downloadUrl
      }
      documentLabel
      minAge
      fieldOrder
      createdAt
      updatedAt
    }
  }
}
    `;
export const GetRequirementFormDocument = gql`
    query GetRequirementForm($id: String!) {
  requirementForm(id: $id) {
    id
    organizationId
    organizationUnitId
    slug
    name
    description
    settings {
      submitButtonLabel
      successTitle
      successMessage
      allowEmbed
    }
    shareToken
    submissionCount
    createdBy
    updatedBy
    createdAt
    updatedAt
    blockRefs {
      id
      formId
      blockId
      fieldOrder
      required
      createdAt
      updatedAt
      block {
        id
        organizationId
        title
        description
        icon
        required
        isEditable
        createdBy
        updatedBy
        createdAt
        updatedAt
        fields {
          id
          blockId
          type
          label
          placeholder
          description
          required
          lockType
          systemKey
          options {
            label
            value
          }
          documents {
            fileId
            filename
            downloadUrl
          }
          documentLabel
          minAge
          fieldOrder
          createdAt
          updatedAt
        }
      }
    }
  }
}
    `;
export const GetRequirementFormByShareTokenDocument = gql`
    query GetRequirementFormByShareToken($token: String!) {
  requirementFormByShareToken(token: $token) {
    id
    organizationUnitId
    name
    description
    settings {
      submitButtonLabel
      successTitle
      successMessage
      allowEmbed
    }
    blockRefs {
      id
      formId
      blockId
      fieldOrder
      required
      block {
        id
        title
        description
        icon
        required
        fields {
          id
          blockId
          type
          label
          placeholder
          description
          required
          systemKey
          options {
            label
            value
          }
          documents {
            fileId
            filename
            downloadUrl
          }
          documentLabel
        }
      }
    }
  }
}
    `;
export const GetRequirementFormsDocument = gql`
    query GetRequirementForms($organizationId: String!, $limit: Int!, $offset: Int!) {
  requirementForms(
    organizationId: $organizationId
    limit: $limit
    offset: $offset
  ) {
    items {
      id
      organizationId
      organizationUnitId
      slug
      name
      description
      settings {
        submitButtonLabel
        successTitle
        successMessage
        allowEmbed
      }
      shareToken
      submissionCount
      createdBy
      updatedBy
      createdAt
      updatedAt
      blockRefs {
        id
        formId
        blockId
        fieldOrder
        required
        createdAt
        updatedAt
        block {
          id
          organizationId
          title
          description
          icon
          required
          isEditable
          createdBy
          updatedBy
          createdAt
          updatedAt
        }
      }
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    `;
export const CreateRequirementFormDocument = gql`
    mutation CreateRequirementForm($input: CreateRequirementFormInput!) {
  createRequirementForm(input: $input) {
    id
    organizationId
    organizationUnitId
    slug
    name
    description
    shareToken
    submissionCount
    createdAt
    updatedAt
  }
}
    `;
export const UpdateRequirementFormDocument = gql`
    mutation UpdateRequirementForm($id: String!, $input: UpdateRequirementFormInput!) {
  updateRequirementForm(id: $id, input: $input) {
    id
    organizationId
    organizationUnitId
    slug
    name
    description
    shareToken
    submissionCount
    updatedAt
  }
}
    `;
export const DeleteRequirementFormDocument = gql`
    mutation DeleteRequirementForm($id: String!) {
  deleteRequirementForm(id: $id) {
    id
  }
}
    `;
export const RegenerateFormShareTokenDocument = gql`
    mutation RegenerateFormShareToken($id: String!) {
  regenerateFormShareToken(id: $id) {
    id
    shareToken
  }
}
    `;
export const SubmitFormDocument = gql`
    mutation SubmitForm($token: String!, $organizationUnitId: ID!, $input: SubmitFormInput!) {
  submitForm(
    token: $token
    organizationUnitId: $organizationUnitId
    input: $input
  ) {
    id
    formId
    userId
    submittedAt
  }
}
    `;
export const SubmitRequiredFormDocument = gql`
    mutation SubmitRequiredForm($targetType: RequiredFormTargetType!, $targetId: String!, $formId: String!, $input: SubmitFormInput!) {
  submitRequiredForm(
    targetType: $targetType
    targetId: $targetId
    formId: $formId
    input: $input
  ) {
    id
    formId
    userId
    submittedAt
  }
}
    `;
export const GetMyFormSubmissionByTokenDocument = gql`
    query GetMyFormSubmissionByToken($token: String!) {
  myFormSubmissionByToken(token: $token) {
    id
    formId
    userId
    submittedAt
  }
}
    `;
export const GetMyFormSubmissionsDocument = gql`
    query GetMyFormSubmissions($organizationUnitId: ID!) {
  myFormSubmissions(organizationUnitId: $organizationUnitId) {
    id
    submittedAt
    form {
      id
      name
      description
      shareToken
    }
  }
}
    `;
export const GetFormSubmissionsByMembershipRequestDocument = gql`
    query GetFormSubmissionsByMembershipRequest($membershipRequestId: String!) {
  formSubmissionsByMembershipRequest(membershipRequestId: $membershipRequestId) {
    id
    submittedAt
    form {
      id
      name
    }
  }
}
    `;
export const GetFormSubmissionsForVolunteerDocument = gql`
    query GetFormSubmissionsForVolunteer($userId: String!) {
  formSubmissionsForVolunteer(userId: $userId) {
    id
    submittedAt
    form {
      id
      name
    }
  }
}
    `;
export const GetAdminFormSubmissionDocument = gql`
    query GetAdminFormSubmission($id: String!) {
  adminVolunteerSubmission(id: $id) {
    id
    submittedAt
    user {
      id
      name
      email
      checkInId
    }
    form {
      id
      name
      blockRefs {
        fieldOrder
        block {
          id
          fields {
            id
            label
            type
            systemKey
            options {
              label
              value
            }
          }
        }
      }
    }
    values {
      fieldId
      value
    }
  }
}
    `;
export const GetFormSubmissionsByFormDocument = gql`
    query GetFormSubmissionsByForm($formId: String!, $limit: Int!, $offset: Int!) {
  formSubmissionsByForm(formId: $formId, limit: $limit, offset: $offset) {
    items {
      id
      submittedAt
      user {
        id
        name
        email
        checkInId
        image
      }
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    `;
export const MyRequiredOrgUnitFormsDocument = gql`
    query MyRequiredOrgUnitForms($organizationUnitId: ID!) {
  myRequiredOrgUnitForms(organizationUnitId: $organizationUnitId) {
    id
    name
    description
    shareToken
  }
}
    `;
export const MyFormSubmissionDocument = gql`
    query MyFormSubmission($id: ID!) {
  myFormSubmission(id: $id) {
    id
    submittedAt
    form {
      id
      name
      blockRefs {
        fieldOrder
        block {
          id
          fields {
            id
            label
            type
            systemKey
            options {
              label
              value
            }
          }
        }
      }
    }
    values {
      fieldId
      value
    }
  }
}
    `;
export const GetAdminUserProfileDocument = gql`
    query GetAdminUserProfile($userId: String!) {
  user(id: $userId) {
    id
    email
    firstname
    lastname
    preferredName
    gender
    phone
    street
    zip
    city
    birthdate
    iban
    accountHolder
    bic
  }
}
    `;
export const CreateRequirementProfileSubmissionDocument = gql`
    mutation CreateRequirementProfileSubmission($input: CreateRequirementProfileSubmissionInput!) {
  createRequirementProfileSubmission(input: $input) {
    id
    status
    requirementProfile {
      id
      name
    }
  }
}
    `;
export const GetRoleDocument = gql`
    query GetRole($id: String!) {
  role(id: $id) {
    id
    name
    description
    isInternal
    permissions {
      id
      key
      description
    }
  }
}
    `;
export const GetRolesDocument = gql`
    query GetRoles {
  roles {
    id
    name
    description
    isInternal
    permissions {
      id
      key
      description
    }
  }
}
    `;
export const GetPermissionsDocument = gql`
    query GetPermissions {
  permissions {
    id
    key
    description
  }
}
    `;
export const GetPermissionGroupsDocument = gql`
    query GetPermissionGroups {
  permissionGroups {
    key
    label
    items {
      label
      permission {
        id
        key
        description
      }
    }
  }
}
    `;
export const CreateRoleDocument = gql`
    mutation createRole($input: CreateRoleInput!) {
  createRole(input: $input) {
    id
    name
    description
    permissions {
      id
      key
    }
  }
}
    `;
export const UpdateRoleDocument = gql`
    mutation UpdateRole($id: ID!, $input: CreateRoleInput!) {
  updateRole(id: $id, input: $input) {
    id
    name
    description
    permissions {
      id
      key
    }
  }
}
    `;
export const DeleteRoleDocument = gql`
    mutation DeleteRole($id: ID!) {
  deleteRole(id: $id) {
    id
    name
  }
}
    `;
export const GetShiftDocument = gql`
    query GetShift($id: String!) {
  shift(id: $id) {
    id
    title
    slug
    instructions
    location
    imageUrl
    visibility
    joinRequiresApproval
    createdAt
    maxVolunteers
    minVolunteers
    reimbursementTypeId
    rrule
    originalStartsAt
    durationMinutes
    organizationUnitId
    reimbursementTypeKey
    requiredFormsCount
    requiredForms {
      ...RequiredFormRefFields
    }
    organizationUnit {
      id
      name
      logoUrl
      myMembershipState
      requiredForms {
        ...RequiredFormRefFields
      }
      organization {
        id
        name
      }
    }
    createdBy {
      id
      name
      image
    }
    event {
      id
      title
      coverImageUrl
    }
  }
}
    ${RequiredFormRefFieldsFragmentDoc}`;
export const GetShiftsDocument = gql`
    query GetShifts($limit: Int!, $offset: Int!) {
  shifts(limit: $limit, offset: $offset) {
    items {
      id
      title
      rrule
      originalStartsAt
      durationMinutes
      visibility
      maxVolunteers
      minVolunteers
      reimbursementTypeId
      requiredFormsCount
      createdBy {
        id
        name
        email
      }
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    `;
export const GetEventShiftsDocument = gql`
    query GetEventShifts($eventId: ID!, $limit: Int!, $offset: Int!) {
  eventShifts(eventId: $eventId, limit: $limit, offset: $offset) {
    items {
      id
      title
      rrule
      originalStartsAt
      durationMinutes
      visibility
      maxVolunteers
      minVolunteers
      requiredFormsCount
      createdBy {
        id
        name
        email
      }
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    `;
export const GetShiftInstancesByMasterIdsDocument = gql`
    query GetShiftInstancesByMasterIds($masterIds: [ID!]!) {
  shiftInstancesByMasterIds(masterIds: $masterIds) {
    masterId
    instances {
      id
      masterId
    }
  }
}
    `;
export const CreateShiftDocument = gql`
    mutation CreateShift($input: CreateShiftInput!) {
  createShift(input: $input) {
    id
  }
}
    `;
export const UpdateShiftDocument = gql`
    mutation UpdateShift($id: String!, $input: UpdateShiftInput!) {
  updateShift(id: $id, input: $input) {
    id
  }
}
    `;
export const DuplicateShiftDocument = gql`
    mutation DuplicateShift($id: String!, $input: DuplicateShiftInput!) {
  duplicateShift(id: $id, input: $input) {
    id
  }
}
    `;
export const DeleteShiftDocument = gql`
    mutation DeleteShift($id: String!) {
  deleteShift(id: $id) {
    id
  }
}
    `;
export const SetShiftRequiredFormsDocument = gql`
    mutation SetShiftRequiredForms($shiftId: ID!, $formIds: [String!]!) {
  setShiftRequiredForms(shiftId: $shiftId, formIds: $formIds) {
    ...RequiredFormRefFields
  }
}
    ${RequiredFormRefFieldsFragmentDoc}`;
export const SetShiftInstanceRequiredFormsDocument = gql`
    mutation SetShiftInstanceRequiredForms($instanceId: ID!, $formIds: [String!]!) {
  setShiftInstanceRequiredForms(instanceId: $instanceId, formIds: $formIds) {
    ...RequiredFormRefFields
  }
}
    ${RequiredFormRefFieldsFragmentDoc}`;
export const UpdateMembersForShiftInstanceDocument = gql`
    mutation UpdateMembersForShiftInstance($instanceId: String!, $memberIds: [String!]!, $inviteToAllInstances: Boolean) {
  updateMembersForShiftInstance(
    instanceId: $instanceId
    memberIds: $memberIds
    inviteToAllInstances: $inviteToAllInstances
  ) {
    id
  }
}
    `;
export const UpdateShiftInstanceDocument = gql`
    mutation UpdateShiftInstance($instanceId: String!, $input: UpdateShiftInstanceInput!, $applyToAllFuture: Boolean) {
  updateShiftInstance(
    instanceId: $instanceId
    input: $input
    applyToAllFuture: $applyToAllFuture
  ) {
    id
  }
}
    `;
export const DeleteShiftInstanceDocument = gql`
    mutation DeleteShiftInstance($id: String!, $applyToAllFuture: Boolean) {
  deleteShiftInstance(id: $id, applyToAllFuture: $applyToAllFuture) {
    id
    isCancelled
  }
}
    `;
export const UpdateShiftInstanceApprovalDocument = gql`
    mutation UpdateShiftInstanceApproval($id: String!, $joinRequiresApproval: Boolean!, $applyToAllFuture: Boolean) {
  updateShiftInstanceApproval(
    id: $id
    joinRequiresApproval: $joinRequiresApproval
    applyToAllFuture: $applyToAllFuture
  ) {
    id
    overrideJoinRequiresApproval
    master {
      id
      joinRequiresApproval
    }
  }
}
    `;
export const UpdateShiftInstanceVolunteersDocument = gql`
    mutation UpdateShiftInstanceVolunteers($instanceId: String!, $memberIds: [String!]!) {
  updateMembersForShiftInstance(instanceId: $instanceId, memberIds: $memberIds) {
    id
  }
}
    `;
export const UpdateShiftInstanceInviteStatusDocument = gql`
    mutation UpdateShiftInstanceInviteStatus($instanceId: String!, $status: ShiftInviteStatus!, $userId: String) {
  updateShiftInstanceInviteStatus(
    instanceId: $instanceId
    status: $status
    userId: $userId
  ) {
    status
    userId
  }
}
    `;
export const SendShiftInstanceCallOutDocument = gql`
    mutation SendShiftInstanceCallOut($instanceId: String!) {
  sendShiftInstanceCallOut(instanceId: $instanceId) {
    recipientCount
    sentToManagerFallback
  }
}
    `;
export const RemindShiftInstanceInviteDocument = gql`
    mutation RemindShiftInstanceInvite($instanceId: String!, $userId: String!) {
  remindShiftInstanceInvite(instanceId: $instanceId, userId: $userId)
}
    `;
export const GetShiftInstanceCallOutSummaryDocument = gql`
    query GetShiftInstanceCallOutSummary($id: ID!) {
  shiftInstance(id: $id) {
    id
    lastCallOut {
      sentAt
      recipientCount
      source
      sentBy {
        id
        name
        image
      }
    }
  }
}
    `;
export const GetShiftInstanceCallOutHistoryDocument = gql`
    query GetShiftInstanceCallOutHistory($id: ID!) {
  shiftInstance(id: $id) {
    id
    callOuts {
      sentAt
      recipientCount
      source
      sentBy {
        id
        name
        image
      }
    }
  }
}
    `;
export const JoinShiftInstanceDocument = gql`
    mutation JoinShiftInstance($instanceId: String!) {
  joinShiftInstance(instanceId: $instanceId) {
    status
    shiftInstance {
      id
      myInviteStatus
      actualStartsAt
      actualEndsAt
      overrideTitle
      overrideInstructions
      overrideLocation
      overrideMaxVolunteers
      isException
      isCancelled
      occurrenceIndex
      master {
        id
        title
      }
    }
    membershipRequestId
    requirementProfile {
      id
      name
      description
      requirements {
        id
        name
        description
        type
        mandatory
      }
    }
    requirementStatuses {
      requirementId
      name
      status
    }
    requiredForms {
      ...RequiredFormWithStatusFields
    }
  }
}
    ${RequiredFormWithStatusFieldsFragmentDoc}`;
export const GetShiftVolunteersDocument = gql`
    query GetShiftVolunteers($instanceId: ID!, $statuses: [ShiftInviteStatus!]) {
  shiftVolunteers(instanceId: $instanceId, statuses: $statuses) {
    id
    name
    email
    image
  }
}
    `;
export const GetActiveShiftInstancesDocument = gql`
    query GetActiveShiftInstances($userId: String!) {
  activeShiftInstances {
    id
    actualStartsAt
    actualEndsAt
    overrideTitle
    invite(userId: $userId) {
      status
    }
    master {
      id
      title
      location
      instructions
      visibility
      maxVolunteers
    }
  }
}
    `;
export const GetShiftInstancesDocument = gql`
    query GetShiftInstances($shiftId: ID!) {
  shiftInstances(shiftId: $shiftId) {
    id
    actualStartsAt
    actualEndsAt
    overrideTitle
    isCancelled
  }
}
    `;
export const GetShiftInstanceDocument = gql`
    query GetShiftInstance($id: ID!) {
  shiftInstance(id: $id) {
    id
    actualStartsAt
    actualEndsAt
    overrideTitle
    overrideLocation
    overrideInstructions
    overrideMaxVolunteers
    overrideMinVolunteers
    overrideReimbursementTypeId
    overrideJoinRequiresApproval
    isCancelled
    filledCount
    spotsLeft
    requiredFormsCount
    requiredForms {
      ...RequiredFormRefFields
    }
    master {
      id
      title
      location
      instructions
      minVolunteers
      maxVolunteers
      reimbursementTypeId
      joinRequiresApproval
      visibility
      rrule
      createdAt
      imageUrl
      createdBy {
        id
        name
        image
      }
    }
    invites {
      status
      remindedAt
      user {
        id
        name
        email
        image
        checkInId
      }
    }
    timeEntries {
      id
      startedAt
      endedAt
      volunteer {
        id
      }
    }
  }
}
    ${RequiredFormRefFieldsFragmentDoc}`;
export const GetWeeklyShiftsDocument = gql`
    query GetWeeklyShifts($startsAfter: DateTime!, $endsBefore: DateTime!, $eventId: ID) {
  weeklyShifts(
    startsAfter: $startsAfter
    endsBefore: $endsBefore
    eventId: $eventId
  ) {
    id
    overrideTitle
    actualStartsAt
    actualEndsAt
    isCancelled
    overrideMinVolunteers
    overrideMaxVolunteers
    overrideReimbursementTypeId
    master {
      id
      title
      minVolunteers
      maxVolunteers
      visibility
      rrule
      reimbursementTypeId
    }
    volunteers {
      id
      name
    }
    invites {
      status
      user {
        id
        name
        email
        image
      }
    }
  }
}
    `;
export const GetPublicShiftInstancesDocument = gql`
    query GetPublicShiftInstances($shiftId: ID!) {
  publicShiftInstances(shiftId: $shiftId) {
    ...PublicShiftDetailInstanceFields
  }
}
    ${PublicShiftDetailInstanceFieldsFragmentDoc}`;
export const GetPublicShiftInstanceDocument = gql`
    query GetPublicShiftInstance($id: ID!) {
  publicShiftInstance(id: $id) {
    ...PublicShiftDetailInstanceFields
  }
}
    ${PublicShiftDetailInstanceFieldsFragmentDoc}`;
export const GetMyShiftInstancesDocument = gql`
    query GetMyShiftInstances($includePast: Boolean = false, $startsAfter: DateTime, $endsBefore: DateTime, $limit: Int = 15, $offset: Int = 0, $order: SortOrder = ASC, $statuses: [ShiftInviteStatus!], $includeIntended: Boolean = false) {
  myShiftInstances(
    includePast: $includePast
    startsAfter: $startsAfter
    endsBefore: $endsBefore
    limit: $limit
    offset: $offset
    order: $order
    statuses: $statuses
    includeIntended: $includeIntended
  ) {
    items {
      ...VolunteerHomeShiftInstance
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    ${VolunteerHomeShiftInstanceFragmentDoc}`;
export const GetAvailableShiftInstancesDocument = gql`
    query GetAvailableShiftInstances($startsAfter: DateTime, $endsBefore: DateTime, $organizationUnitIds: [ID!], $limit: Int = 15, $offset: Int = 0) {
  availableShiftInstances(
    startsAfter: $startsAfter
    endsBefore: $endsBefore
    organizationUnitIds: $organizationUnitIds
    limit: $limit
    offset: $offset
  ) {
    items {
      ...VolunteerHomeShiftInstance
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    ${VolunteerHomeShiftInstanceFragmentDoc}`;
export const GetAvailableShiftInstanceDayCountsDocument = gql`
    query GetAvailableShiftInstanceDayCounts($startsAfter: DateTime, $endsBefore: DateTime, $organizationUnitIds: [ID!], $excludeIntended: Boolean = false) {
  availableShiftInstanceDayCounts(
    startsAfter: $startsAfter
    endsBefore: $endsBefore
    organizationUnitIds: $organizationUnitIds
    excludeIntended: $excludeIntended
  ) {
    date
    count
  }
}
    `;
export const CheckInDocument = gql`
    mutation CheckIn($shiftInstanceId: ID!) {
  checkIn(shiftInstanceId: $shiftInstanceId) {
    id
  }
}
    `;
export const CheckOutDocument = gql`
    mutation CheckOut($shiftInstanceId: ID!) {
  checkOut(shiftInstanceId: $shiftInstanceId) {
    id
  }
}
    `;
export const GetCheckInShiftInstancesDocument = gql`
    query GetCheckInShiftInstances($startsAfter: DateTime!, $endsBefore: DateTime!) {
  checkInShiftInstances(startsAfter: $startsAfter, endsBefore: $endsBefore) {
    id
    actualStartsAt
    actualEndsAt
    overrideTitle
    master {
      id
      title
    }
  }
}
    `;
export const GetCheckInShiftsDocument = gql`
    query GetCheckInShifts($search: String) {
  checkInShifts(search: $search) {
    id
    title
  }
}
    `;
export const CheckInInviteToShiftInstanceDocument = gql`
    mutation CheckInInviteToShiftInstance($shiftInstanceId: ID!, $volunteerId: ID!) {
  checkInInviteToShiftInstance(
    shiftInstanceId: $shiftInstanceId
    volunteerId: $volunteerId
  ) {
    id
  }
}
    `;
export const TermsStatusDocument = gql`
    query TermsStatus {
  termsStatus {
    mustAccept
    currentVersion
    currentClass
    acceptedVersion
    acceptedAt
  }
}
    `;
export const AcceptTermsDocument = gql`
    mutation AcceptTerms($input: AcceptTermsInput!) {
  acceptTerms(input: $input) {
    mustAccept
    currentVersion
    currentClass
    acceptedVersion
    acceptedAt
  }
}
    `;
export const AddTimeEntryDocument = gql`
    mutation AddTimeEntry($input: AddTimeEntryInput!) {
  addTimeEntry(input: $input) {
    id
  }
}
    `;
export const DeleteTimeEntryDocument = gql`
    mutation DeleteTimeEntry($id: ID!) {
  deleteTimeEntry(id: $id) {
    id
  }
}
    `;
export const CloseTimeEntryDocument = gql`
    mutation CloseTimeEntry($id: ID!, $input: CloseTimeEntryInput!) {
  closeTimeEntry(id: $id, input: $input) {
    id
  }
}
    `;
export const GetTimeEntryDocument = gql`
    query GetTimeEntry($id: String!) {
  timeEntry(id: $id) {
    id
    startedAt
    endedAt
    notes
    createdAt
    createdBy {
      id
      name
      email
    }
    isPaid
    reimbursementType {
      id
      key
    }
    volunteer {
      id
      name
      email
    }
    shiftInstance {
      id
      actualStartsAt
      actualEndsAt
      overrideTitle
      master {
        id
        title
      }
    }
    organizationUnit {
      id
      name
      organization {
        id
        name
      }
    }
  }
}
    `;
export const UpdateTimeEntryDocument = gql`
    mutation UpdateTimeEntry($id: ID!, $input: UpdateTimeEntryInput!) {
  updateTimeEntry(id: $id, input: $input) {
    id
  }
}
    `;
export const GetTimeEntriesDocument = gql`
    query GetTimeEntries($limit: Int!, $offset: Int!, $sort: TimeEntrySortField, $order: SortOrder) {
  timeEntries(limit: $limit, offset: $offset, sort: $sort, order: $order) {
    items {
      id
      startedAt
      endedAt
      createdAt
      createdBy {
        id
        name
        email
      }
      volunteer {
        id
        name
        email
      }
      shiftInstance {
        id
        actualStartsAt
        actualEndsAt
        overrideTitle
        master {
          id
          title
        }
      }
      organizationUnit {
        id
        name
        organization {
          id
          name
        }
      }
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    `;
export const GetTimeEntriesByUserDocument = gql`
    query GetTimeEntriesByUser($userId: String!, $limit: Int!, $offset: Int!) {
  timeEntriesByUser(userId: $userId, limit: $limit, offset: $offset) {
    items {
      id
      startedAt
      endedAt
      shiftInstance {
        id
        actualStartsAt
        actualEndsAt
        overrideTitle
        master {
          id
          title
        }
      }
      organizationUnit {
        id
        name
        organization {
          id
          name
        }
      }
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    `;
export const GetMyTimeDocument = gql`
    query GetMyTime($limit: Int!, $offset: Int!) {
  myTime(limit: $limit, offset: $offset) {
    items {
      id
      startedAt
      endedAt
      shiftInstance {
        id
        overrideTitle
        master {
          id
          title
          organizationUnit {
            id
            name
            organization {
              id
              name
            }
          }
        }
      }
      organizationUnit {
        id
        name
        organization {
          id
          name
        }
      }
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    `;
export const GetCheckInContextDocument = gql`
    query GetCheckInContext($checkInId: String!) {
  checkInContext(checkInId: $checkInId) {
    volunteer {
      id
      name
      email
      image
    }
    eligibleOrganizationUnits {
      id
      name
    }
    openTimeEntries {
      id
      startedAt
      shiftInstance {
        id
        overrideTitle
        master {
          id
          title
        }
      }
      organizationUnit {
        id
        name
        organization {
          id
          name
        }
      }
    }
  }
}
    `;
export const GetCheckInReadinessDocument = gql`
    query GetCheckInReadiness($volunteerId: ID!, $shiftInstanceId: ID) {
  checkInReadiness(volunteerId: $volunteerId, shiftInstanceId: $shiftInstanceId) {
    isMember
    openMembershipRequestId
    shiftInviteStatus
    isParticipating
    hasOpenTimeEntry
    idVerificationEnabled
    idVerified
    membershipId
    agreement {
      status
      reimbursementTypeName
      contractId
      canManageAgreements
      managerNames
    }
  }
}
    `;
export const GetCheckInVolunteerRequiredFormsDocument = gql`
    query GetCheckInVolunteerRequiredForms($volunteerId: ID!) {
  checkInVolunteerRequiredForms(volunteerId: $volunteerId) {
    form {
      id
      name
    }
    order
    submitted
    submissionId
  }
}
    `;
export const CheckInVolunteerDocument = gql`
    mutation CheckInVolunteer($volunteerId: ID!, $shiftInstanceId: ID, $startedAt: DateTime) {
  checkInVolunteer(
    volunteerId: $volunteerId
    shiftInstanceId: $shiftInstanceId
    startedAt: $startedAt
  ) {
    id
  }
}
    `;
export const CheckInInviteToOrganizationDocument = gql`
    mutation CheckInInviteToOrganization($volunteerId: ID!) {
  checkInInviteToOrganization(volunteerId: $volunteerId)
}
    `;
export const CheckOutVolunteerDocument = gql`
    mutation CheckOutVolunteer($timeEntryId: ID!) {
  checkOutVolunteer(timeEntryId: $timeEntryId) {
    id
  }
}
    `;
export const GetMeDocument = gql`
    query GetMe {
  me {
    id
    name
    email
    image
    checkInId
    locale
    emailWeeklyUpdateEnabled
    emailUrgentCallsEnabled
    emailPlatformEnabled
    firstname
    lastname
    preferredName
    gender
    phone
    street
    zip
    city
    birthdate
    iban
    accountHolder
    bic
  }
}
    `;
export const GetUserDocument = gql`
    query GetUser($id: String!) {
  user(id: $id) {
    id
    name
    email
    image
    checkInId
    locale
    firstname
    lastname
    preferredName
    gender
    phone
    street
    zip
    city
    birthdate
    iban
    accountHolder
    bic
  }
}
    `;
export const GetMyPermissionsDocument = gql`
    query GetMyPermissions {
  me {
    id
    permissions {
      id
      key
    }
  }
}
    `;
export const GetMyOrganizationsDocument = gql`
    query GetMyOrganizations($limit: Int!, $offset: Int!) {
  organizations(limit: $limit, offset: $offset) {
    items {
      id
      name
      slug
      description
      logoUrl
    }
    pagination {
      total
      limit
      offset
      hasMore
    }
  }
}
    `;
export const UpdateMyLocaleDocument = gql`
    mutation UpdateMyLocale($locale: String!) {
  updateMyLocale(locale: $locale) {
    id
    locale
  }
}
    `;
export const UpdateMyImageDocument = gql`
    mutation UpdateMyImage($input: UpdateMyImageInput!) {
  updateMyImage(input: $input) {
    id
    image
  }
}
    `;
export const UpdateMyAccountSettingsDocument = gql`
    mutation UpdateMyAccountSettings($input: UpdateMyAccountSettingsInput!) {
  updateMyAccountSettings(input: $input) {
    id
    locale
    emailWeeklyUpdateEnabled
    emailUrgentCallsEnabled
    emailPlatformEnabled
  }
}
    `;
export const UnsubscribeFromEmailsDocument = gql`
    mutation UnsubscribeFromEmails {
  unsubscribeFromEmails
}
    `;
export const UpdateMyProfileDocument = gql`
    mutation UpdateMyProfile($input: UpdateMyProfileInput!) {
  updateMyProfile(input: $input) {
    id
    firstname
    lastname
    preferredName
    gender
    phone
    street
    zip
    city
    birthdate
    iban
    accountHolder
    bic
    email
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    GetReimbursementTypes(variables?: GetReimbursementTypesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetReimbursementTypesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetReimbursementTypesQuery>({ document: GetReimbursementTypesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetReimbursementTypes', 'query', variables);
    },
    GetEffectiveRates(variables?: GetEffectiveRatesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetEffectiveRatesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetEffectiveRatesQuery>({ document: GetEffectiveRatesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetEffectiveRates', 'query', variables);
    },
    SetReimbursementRate(variables: SetReimbursementRateMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SetReimbursementRateMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SetReimbursementRateMutation>({ document: SetReimbursementRateDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SetReimbursementRate', 'mutation', variables);
    },
    GetYearlyUsage(variables: GetYearlyUsageQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetYearlyUsageQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetYearlyUsageQuery>({ document: GetYearlyUsageDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetYearlyUsage', 'query', variables);
    },
    GetVolunteerAllowanceStates(variables: GetVolunteerAllowanceStatesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetVolunteerAllowanceStatesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetVolunteerAllowanceStatesQuery>({ document: GetVolunteerAllowanceStatesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetVolunteerAllowanceStates', 'query', variables);
    },
    GetRosterYearlyUsage(variables: GetRosterYearlyUsageQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetRosterYearlyUsageQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetRosterYearlyUsageQuery>({ document: GetRosterYearlyUsageDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetRosterYearlyUsage', 'query', variables);
    },
    GetContracts(variables?: GetContractsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetContractsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetContractsQuery>({ document: GetContractsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetContracts', 'query', variables);
    },
    GetMyContracts(variables?: GetMyContractsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyContractsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyContractsQuery>({ document: GetMyContractsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyContracts', 'query', variables);
    },
    GetContract(variables: GetContractQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetContractQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetContractQuery>({ document: GetContractDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetContract', 'query', variables);
    },
    GetPendingContractSignee(variables: GetPendingContractSigneeQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPendingContractSigneeQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPendingContractSigneeQuery>({ document: GetPendingContractSigneeDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPendingContractSignee', 'query', variables);
    },
    CreateContract(variables: CreateContractMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateContractMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateContractMutation>({ document: CreateContractDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreateContract', 'mutation', variables);
    },
    SignContract(variables: SignContractMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SignContractMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SignContractMutation>({ document: SignContractDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SignContract', 'mutation', variables);
    },
    DeclineContract(variables: DeclineContractMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeclineContractMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeclineContractMutation>({ document: DeclineContractDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeclineContract', 'mutation', variables);
    },
    GetInvoices(variables?: GetInvoicesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetInvoicesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetInvoicesQuery>({ document: GetInvoicesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetInvoices', 'query', variables);
    },
    GetMyInvoices(variables?: GetMyInvoicesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyInvoicesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyInvoicesQuery>({ document: GetMyInvoicesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyInvoices', 'query', variables);
    },
    GetInvoice(variables: GetInvoiceQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetInvoiceQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetInvoiceQuery>({ document: GetInvoiceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetInvoice', 'query', variables);
    },
    GetPendingInvoiceSignee(variables: GetPendingInvoiceSigneeQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPendingInvoiceSigneeQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPendingInvoiceSigneeQuery>({ document: GetPendingInvoiceSigneeDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPendingInvoiceSignee', 'query', variables);
    },
    GetVolunteersNeedingTimesheets(variables?: GetVolunteersNeedingTimesheetsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetVolunteersNeedingTimesheetsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetVolunteersNeedingTimesheetsQuery>({ document: GetVolunteersNeedingTimesheetsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetVolunteersNeedingTimesheets', 'query', variables);
    },
    GetPaidShiftSignupVolunteers(variables: GetPaidShiftSignupVolunteersQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPaidShiftSignupVolunteersQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPaidShiftSignupVolunteersQuery>({ document: GetPaidShiftSignupVolunteersDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPaidShiftSignupVolunteers', 'query', variables);
    },
    GetEligibleTimeEntriesForInvoice(variables: GetEligibleTimeEntriesForInvoiceQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetEligibleTimeEntriesForInvoiceQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetEligibleTimeEntriesForInvoiceQuery>({ document: GetEligibleTimeEntriesForInvoiceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetEligibleTimeEntriesForInvoice', 'query', variables);
    },
    CreateInvoice(variables: CreateInvoiceMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateInvoiceMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateInvoiceMutation>({ document: CreateInvoiceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreateInvoice', 'mutation', variables);
    },
    SignInvoice(variables: SignInvoiceMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SignInvoiceMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SignInvoiceMutation>({ document: SignInvoiceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SignInvoice', 'mutation', variables);
    },
    DeclineInvoice(variables: DeclineInvoiceMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeclineInvoiceMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeclineInvoiceMutation>({ document: DeclineInvoiceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeclineInvoice', 'mutation', variables);
    },
    GetDocumentTemplates(variables?: GetDocumentTemplatesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetDocumentTemplatesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetDocumentTemplatesQuery>({ document: GetDocumentTemplatesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetDocumentTemplates', 'query', variables);
    },
    GetDocumentTemplate(variables: GetDocumentTemplateQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetDocumentTemplateQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetDocumentTemplateQuery>({ document: GetDocumentTemplateDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetDocumentTemplate', 'query', variables);
    },
    GetActiveDocumentTemplate(variables: GetActiveDocumentTemplateQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetActiveDocumentTemplateQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetActiveDocumentTemplateQuery>({ document: GetActiveDocumentTemplateDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetActiveDocumentTemplate', 'query', variables);
    },
    CreateDocumentTemplate(variables: CreateDocumentTemplateMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateDocumentTemplateMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateDocumentTemplateMutation>({ document: CreateDocumentTemplateDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreateDocumentTemplate', 'mutation', variables);
    },
    UpdateDocumentTemplate(variables: UpdateDocumentTemplateMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateDocumentTemplateMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateDocumentTemplateMutation>({ document: UpdateDocumentTemplateDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateDocumentTemplate', 'mutation', variables);
    },
    DeleteDocumentTemplate(variables: DeleteDocumentTemplateMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeleteDocumentTemplateMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteDocumentTemplateMutation>({ document: DeleteDocumentTemplateDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeleteDocumentTemplate', 'mutation', variables);
    },
    GetBundleDownloadStatus(variables: GetBundleDownloadStatusQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetBundleDownloadStatusQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetBundleDownloadStatusQuery>({ document: GetBundleDownloadStatusDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetBundleDownloadStatus', 'query', variables);
    },
    RecordBundleDownload(variables: RecordBundleDownloadMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<RecordBundleDownloadMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<RecordBundleDownloadMutation>({ document: RecordBundleDownloadDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'RecordBundleDownload', 'mutation', variables);
    },
    GetManualBaseline(variables: GetManualBaselineQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetManualBaselineQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetManualBaselineQuery>({ document: GetManualBaselineDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetManualBaseline', 'query', variables);
    },
    SetManualBaseline(variables: SetManualBaselineMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SetManualBaselineMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SetManualBaselineMutation>({ document: SetManualBaselineDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SetManualBaseline', 'mutation', variables);
    },
    MyDocuments(variables?: MyDocumentsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MyDocumentsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MyDocumentsQuery>({ document: MyDocumentsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MyDocuments', 'query', variables);
    },
    MyDocumentSummary(variables?: MyDocumentSummaryQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MyDocumentSummaryQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MyDocumentSummaryQuery>({ document: MyDocumentSummaryDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MyDocumentSummary', 'query', variables);
    },
    GetAccountingSetupStatus(variables?: GetAccountingSetupStatusQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAccountingSetupStatusQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAccountingSetupStatusQuery>({ document: GetAccountingSetupStatusDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAccountingSetupStatus', 'query', variables);
    },
    GetEvents(variables: GetEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetEventsQuery>({ document: GetEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetEvents', 'query', variables);
    },
    GetMyEvents(variables?: GetMyEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyEventsQuery>({ document: GetMyEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyEvents', 'query', variables);
    },
    GetAvailableEvents(variables?: GetAvailableEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAvailableEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAvailableEventsQuery>({ document: GetAvailableEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAvailableEvents', 'query', variables);
    },
    GetEvent(variables: GetEventQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetEventQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetEventQuery>({ document: GetEventDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetEvent', 'query', variables);
    },
    GetEventInvites(variables: GetEventInvitesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetEventInvitesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetEventInvitesQuery>({ document: GetEventInvitesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetEventInvites', 'query', variables);
    },
    CreateEvent(variables: CreateEventMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateEventMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateEventMutation>({ document: CreateEventDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreateEvent', 'mutation', variables);
    },
    UpdateEvent(variables: UpdateEventMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateEventMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateEventMutation>({ document: UpdateEventDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateEvent', 'mutation', variables);
    },
    DeleteEvent(variables: DeleteEventMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeleteEventMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteEventMutation>({ document: DeleteEventDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeleteEvent', 'mutation', variables);
    },
    InviteMembersToEvent(variables: InviteMembersToEventMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<InviteMembersToEventMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<InviteMembersToEventMutation>({ document: InviteMembersToEventDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'InviteMembersToEvent', 'mutation', variables);
    },
    UpdateEventInviteStatus(variables: UpdateEventInviteStatusMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateEventInviteStatusMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateEventInviteStatusMutation>({ document: UpdateEventInviteStatusDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateEventInviteStatus', 'mutation', variables);
    },
    GetPublicEvent(variables: GetPublicEventQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPublicEventQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPublicEventQuery>({ document: GetPublicEventDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPublicEvent', 'query', variables);
    },
    JoinEvent(variables: JoinEventMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<JoinEventMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<JoinEventMutation>({ document: JoinEventDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'JoinEvent', 'mutation', variables);
    },
    SetEventRequiredForms(variables: SetEventRequiredFormsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SetEventRequiredFormsMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SetEventRequiredFormsMutation>({ document: SetEventRequiredFormsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SetEventRequiredForms', 'mutation', variables);
    },
    GetOrganizationUnitMemberships(variables?: GetOrganizationUnitMembershipsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationUnitMembershipsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationUnitMembershipsQuery>({ document: GetOrganizationUnitMembershipsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizationUnitMemberships', 'query', variables);
    },
    GetMyMembershipStatus(variables: GetMyMembershipStatusQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyMembershipStatusQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyMembershipStatusQuery>({ document: GetMyMembershipStatusDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyMembershipStatus', 'query', variables);
    },
    UpdateMembershipRoles(variables: UpdateMembershipRolesMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateMembershipRolesMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateMembershipRolesMutation>({ document: UpdateMembershipRolesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateMembershipRoles', 'mutation', variables);
    },
    LeaveMembership(variables: LeaveMembershipMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<LeaveMembershipMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<LeaveMembershipMutation>({ document: LeaveMembershipDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'LeaveMembership', 'mutation', variables);
    },
    RemoveMembership(variables: RemoveMembershipMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<RemoveMembershipMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<RemoveMembershipMutation>({ document: RemoveMembershipDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'RemoveMembership', 'mutation', variables);
    },
    MyMemberships(variables?: MyMembershipsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MyMembershipsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MyMembershipsQuery>({ document: MyMembershipsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MyMemberships', 'query', variables);
    },
    MyMembership(variables: MyMembershipQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MyMembershipQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MyMembershipQuery>({ document: MyMembershipDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MyMembership', 'query', variables);
    },
    SetMembershipIdVerified(variables: SetMembershipIdVerifiedMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SetMembershipIdVerifiedMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SetMembershipIdVerifiedMutation>({ document: SetMembershipIdVerifiedDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SetMembershipIdVerified', 'mutation', variables);
    },
    JoinOrganization(variables: JoinOrganizationMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<JoinOrganizationMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<JoinOrganizationMutation>({ document: JoinOrganizationDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'JoinOrganization', 'mutation', variables);
    },
    ApproveMembershipRequest(variables: ApproveMembershipRequestMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<ApproveMembershipRequestMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<ApproveMembershipRequestMutation>({ document: ApproveMembershipRequestDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'ApproveMembershipRequest', 'mutation', variables);
    },
    RejectMembershipRequest(variables: RejectMembershipRequestMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<RejectMembershipRequestMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<RejectMembershipRequestMutation>({ document: RejectMembershipRequestDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'RejectMembershipRequest', 'mutation', variables);
    },
    CancelMembershipRequest(variables: CancelMembershipRequestMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CancelMembershipRequestMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CancelMembershipRequestMutation>({ document: CancelMembershipRequestDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CancelMembershipRequest', 'mutation', variables);
    },
    RemoveMembershipRequest(variables: RemoveMembershipRequestMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<RemoveMembershipRequestMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<RemoveMembershipRequestMutation>({ document: RemoveMembershipRequestDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'RemoveMembershipRequest', 'mutation', variables);
    },
    GetMembershipRequests(variables: GetMembershipRequestsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMembershipRequestsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMembershipRequestsQuery>({ document: GetMembershipRequestsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMembershipRequests', 'query', variables);
    },
    GetMembershipRequestCount(variables?: GetMembershipRequestCountQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMembershipRequestCountQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMembershipRequestCountQuery>({ document: GetMembershipRequestCountDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMembershipRequestCount', 'query', variables);
    },
    GetMyMembershipRequests(variables: GetMyMembershipRequestsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyMembershipRequestsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyMembershipRequestsQuery>({ document: GetMyMembershipRequestsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyMembershipRequests', 'query', variables);
    },
    CheckInApproveMembershipRequest(variables: CheckInApproveMembershipRequestMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CheckInApproveMembershipRequestMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CheckInApproveMembershipRequestMutation>({ document: CheckInApproveMembershipRequestDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CheckInApproveMembershipRequest', 'mutation', variables);
    },
    GetOrganization(variables: GetOrganizationQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationQuery>({ document: GetOrganizationDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganization', 'query', variables);
    },
    GetOrganizationBySlug(variables: GetOrganizationBySlugQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationBySlugQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationBySlugQuery>({ document: GetOrganizationBySlugDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizationBySlug', 'query', variables);
    },
    GetOrganizationRoot(variables: GetOrganizationRootQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationRootQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationRootQuery>({ document: GetOrganizationRootDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizationRoot', 'query', variables);
    },
    GetOrganizationUnit(variables: GetOrganizationUnitQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationUnitQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationUnitQuery>({ document: GetOrganizationUnitDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizationUnit', 'query', variables);
    },
    GetOrganizationVolunteersByUnit(variables: GetOrganizationVolunteersByUnitQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationVolunteersByUnitQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationVolunteersByUnitQuery>({ document: GetOrganizationVolunteersByUnitDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizationVolunteersByUnit', 'query', variables);
    },
    GetOrganizationUnitWithOrg(variables: GetOrganizationUnitWithOrgQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationUnitWithOrgQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationUnitWithOrgQuery>({ document: GetOrganizationUnitWithOrgDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizationUnitWithOrg', 'query', variables);
    },
    GetOrganizationUnitPublicInfo(variables: GetOrganizationUnitPublicInfoQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationUnitPublicInfoQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationUnitPublicInfoQuery>({ document: GetOrganizationUnitPublicInfoDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizationUnitPublicInfo', 'query', variables);
    },
    GetOrganizationsWithRoot(variables: GetOrganizationsWithRootQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationsWithRootQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationsWithRootQuery>({ document: GetOrganizationsWithRootDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizationsWithRoot', 'query', variables);
    },
    GetMyOrganizationUnits(variables?: GetMyOrganizationUnitsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyOrganizationUnitsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyOrganizationUnitsQuery>({ document: GetMyOrganizationUnitsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyOrganizationUnits', 'query', variables);
    },
    GetMyAdminstableOrganizationUnits(variables?: GetMyAdminstableOrganizationUnitsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyAdminstableOrganizationUnitsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyAdminstableOrganizationUnitsQuery>({ document: GetMyAdminstableOrganizationUnitsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyAdminstableOrganizationUnits', 'query', variables);
    },
    GetMyCheckInAdministrableOrganizationUnits(variables?: GetMyCheckInAdministrableOrganizationUnitsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyCheckInAdministrableOrganizationUnitsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyCheckInAdministrableOrganizationUnitsQuery>({ document: GetMyCheckInAdministrableOrganizationUnitsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyCheckInAdministrableOrganizationUnits', 'query', variables);
    },
    GetOrganizations(variables: GetOrganizationsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationsQuery>({ document: GetOrganizationsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizations', 'query', variables);
    },
    CreateOrganization(variables: CreateOrganizationMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateOrganizationMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateOrganizationMutation>({ document: CreateOrganizationDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreateOrganization', 'mutation', variables);
    },
    UpdateOrganization(variables: UpdateOrganizationMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateOrganizationMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateOrganizationMutation>({ document: UpdateOrganizationDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateOrganization', 'mutation', variables);
    },
    GetOrganizationTree(variables?: GetOrganizationTreeQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationTreeQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationTreeQuery>({ document: GetOrganizationTreeDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizationTree', 'query', variables);
    },
    GetOrganizationUnitTypes(variables?: GetOrganizationUnitTypesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationUnitTypesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationUnitTypesQuery>({ document: GetOrganizationUnitTypesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizationUnitTypes', 'query', variables);
    },
    CreateOrganizationUnit(variables: CreateOrganizationUnitMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateOrganizationUnitMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateOrganizationUnitMutation>({ document: CreateOrganizationUnitDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreateOrganizationUnit', 'mutation', variables);
    },
    UpdateOrganizationUnit(variables: UpdateOrganizationUnitMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateOrganizationUnitMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateOrganizationUnitMutation>({ document: UpdateOrganizationUnitDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateOrganizationUnit', 'mutation', variables);
    },
    RequestOrganizationUnitDeletion(variables: RequestOrganizationUnitDeletionMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<RequestOrganizationUnitDeletionMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<RequestOrganizationUnitDeletionMutation>({ document: RequestOrganizationUnitDeletionDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'RequestOrganizationUnitDeletion', 'mutation', variables);
    },
    IsMemberOfOrgUnitOrAncestor(variables: IsMemberOfOrgUnitOrAncestorQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<IsMemberOfOrgUnitOrAncestorQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<IsMemberOfOrgUnitOrAncestorQuery>({ document: IsMemberOfOrgUnitOrAncestorDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'IsMemberOfOrgUnitOrAncestor', 'query', variables);
    },
    SetRequiredForms(variables: SetRequiredFormsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SetRequiredFormsMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SetRequiredFormsMutation>({ document: SetRequiredFormsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SetRequiredForms', 'mutation', variables);
    },
    GetOrganizationUnitAutomations(variables: GetOrganizationUnitAutomationsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetOrganizationUnitAutomationsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetOrganizationUnitAutomationsQuery>({ document: GetOrganizationUnitAutomationsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetOrganizationUnitAutomations', 'query', variables);
    },
    UpdateOrganizationUnitAutomation(variables: UpdateOrganizationUnitAutomationMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateOrganizationUnitAutomationMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateOrganizationUnitAutomationMutation>({ document: UpdateOrganizationUnitAutomationDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateOrganizationUnitAutomation', 'mutation', variables);
    },
    GetPublicOrganizationUnit(variables: GetPublicOrganizationUnitQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPublicOrganizationUnitQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPublicOrganizationUnitQuery>({ document: GetPublicOrganizationUnitDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPublicOrganizationUnit', 'query', variables);
    },
    GetPublicEventsByOrganizationUnit(variables: GetPublicEventsByOrganizationUnitQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPublicEventsByOrganizationUnitQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPublicEventsByOrganizationUnitQuery>({ document: GetPublicEventsByOrganizationUnitDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPublicEventsByOrganizationUnit', 'query', variables);
    },
    GetPublicShiftsByOrganizationUnit(variables: GetPublicShiftsByOrganizationUnitQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPublicShiftsByOrganizationUnitQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPublicShiftsByOrganizationUnitQuery>({ document: GetPublicShiftsByOrganizationUnitDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPublicShiftsByOrganizationUnit', 'query', variables);
    },
    GetFormBlock(variables: GetFormBlockQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetFormBlockQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetFormBlockQuery>({ document: GetFormBlockDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetFormBlock', 'query', variables);
    },
    GetFormBlocks(variables: GetFormBlocksQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetFormBlocksQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetFormBlocksQuery>({ document: GetFormBlocksDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetFormBlocks', 'query', variables);
    },
    CreateFormBlock(variables: CreateFormBlockMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateFormBlockMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateFormBlockMutation>({ document: CreateFormBlockDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreateFormBlock', 'mutation', variables);
    },
    UpdateFormBlock(variables: UpdateFormBlockMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateFormBlockMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateFormBlockMutation>({ document: UpdateFormBlockDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateFormBlock', 'mutation', variables);
    },
    DeleteFormBlock(variables: DeleteFormBlockMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeleteFormBlockMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteFormBlockMutation>({ document: DeleteFormBlockDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeleteFormBlock', 'mutation', variables);
    },
    CreateFormBlockField(variables: CreateFormBlockFieldMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateFormBlockFieldMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateFormBlockFieldMutation>({ document: CreateFormBlockFieldDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreateFormBlockField', 'mutation', variables);
    },
    UpdateFormBlockField(variables: UpdateFormBlockFieldMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateFormBlockFieldMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateFormBlockFieldMutation>({ document: UpdateFormBlockFieldDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateFormBlockField', 'mutation', variables);
    },
    DeleteFormBlockField(variables: DeleteFormBlockFieldMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeleteFormBlockFieldMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteFormBlockFieldMutation>({ document: DeleteFormBlockFieldDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeleteFormBlockField', 'mutation', variables);
    },
    GetRequirementForm(variables: GetRequirementFormQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetRequirementFormQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetRequirementFormQuery>({ document: GetRequirementFormDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetRequirementForm', 'query', variables);
    },
    GetRequirementFormByShareToken(variables: GetRequirementFormByShareTokenQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetRequirementFormByShareTokenQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetRequirementFormByShareTokenQuery>({ document: GetRequirementFormByShareTokenDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetRequirementFormByShareToken', 'query', variables);
    },
    GetRequirementForms(variables: GetRequirementFormsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetRequirementFormsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetRequirementFormsQuery>({ document: GetRequirementFormsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetRequirementForms', 'query', variables);
    },
    CreateRequirementForm(variables: CreateRequirementFormMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateRequirementFormMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateRequirementFormMutation>({ document: CreateRequirementFormDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreateRequirementForm', 'mutation', variables);
    },
    UpdateRequirementForm(variables: UpdateRequirementFormMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateRequirementFormMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateRequirementFormMutation>({ document: UpdateRequirementFormDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateRequirementForm', 'mutation', variables);
    },
    DeleteRequirementForm(variables: DeleteRequirementFormMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeleteRequirementFormMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteRequirementFormMutation>({ document: DeleteRequirementFormDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeleteRequirementForm', 'mutation', variables);
    },
    RegenerateFormShareToken(variables: RegenerateFormShareTokenMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<RegenerateFormShareTokenMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<RegenerateFormShareTokenMutation>({ document: RegenerateFormShareTokenDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'RegenerateFormShareToken', 'mutation', variables);
    },
    SubmitForm(variables: SubmitFormMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SubmitFormMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SubmitFormMutation>({ document: SubmitFormDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SubmitForm', 'mutation', variables);
    },
    SubmitRequiredForm(variables: SubmitRequiredFormMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SubmitRequiredFormMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SubmitRequiredFormMutation>({ document: SubmitRequiredFormDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SubmitRequiredForm', 'mutation', variables);
    },
    GetMyFormSubmissionByToken(variables: GetMyFormSubmissionByTokenQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyFormSubmissionByTokenQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyFormSubmissionByTokenQuery>({ document: GetMyFormSubmissionByTokenDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyFormSubmissionByToken', 'query', variables);
    },
    GetMyFormSubmissions(variables: GetMyFormSubmissionsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyFormSubmissionsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyFormSubmissionsQuery>({ document: GetMyFormSubmissionsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyFormSubmissions', 'query', variables);
    },
    GetFormSubmissionsByMembershipRequest(variables: GetFormSubmissionsByMembershipRequestQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetFormSubmissionsByMembershipRequestQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetFormSubmissionsByMembershipRequestQuery>({ document: GetFormSubmissionsByMembershipRequestDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetFormSubmissionsByMembershipRequest', 'query', variables);
    },
    GetFormSubmissionsForVolunteer(variables: GetFormSubmissionsForVolunteerQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetFormSubmissionsForVolunteerQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetFormSubmissionsForVolunteerQuery>({ document: GetFormSubmissionsForVolunteerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetFormSubmissionsForVolunteer', 'query', variables);
    },
    GetAdminFormSubmission(variables: GetAdminFormSubmissionQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAdminFormSubmissionQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAdminFormSubmissionQuery>({ document: GetAdminFormSubmissionDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAdminFormSubmission', 'query', variables);
    },
    GetFormSubmissionsByForm(variables: GetFormSubmissionsByFormQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetFormSubmissionsByFormQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetFormSubmissionsByFormQuery>({ document: GetFormSubmissionsByFormDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetFormSubmissionsByForm', 'query', variables);
    },
    MyRequiredOrgUnitForms(variables: MyRequiredOrgUnitFormsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MyRequiredOrgUnitFormsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MyRequiredOrgUnitFormsQuery>({ document: MyRequiredOrgUnitFormsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MyRequiredOrgUnitForms', 'query', variables);
    },
    MyFormSubmission(variables: MyFormSubmissionQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MyFormSubmissionQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MyFormSubmissionQuery>({ document: MyFormSubmissionDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MyFormSubmission', 'query', variables);
    },
    GetAdminUserProfile(variables: GetAdminUserProfileQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAdminUserProfileQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAdminUserProfileQuery>({ document: GetAdminUserProfileDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAdminUserProfile', 'query', variables);
    },
    CreateRequirementProfileSubmission(variables: CreateRequirementProfileSubmissionMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateRequirementProfileSubmissionMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateRequirementProfileSubmissionMutation>({ document: CreateRequirementProfileSubmissionDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreateRequirementProfileSubmission', 'mutation', variables);
    },
    GetRole(variables: GetRoleQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetRoleQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetRoleQuery>({ document: GetRoleDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetRole', 'query', variables);
    },
    GetRoles(variables?: GetRolesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetRolesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetRolesQuery>({ document: GetRolesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetRoles', 'query', variables);
    },
    GetPermissions(variables?: GetPermissionsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPermissionsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPermissionsQuery>({ document: GetPermissionsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPermissions', 'query', variables);
    },
    GetPermissionGroups(variables?: GetPermissionGroupsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPermissionGroupsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPermissionGroupsQuery>({ document: GetPermissionGroupsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPermissionGroups', 'query', variables);
    },
    createRole(variables: CreateRoleMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateRoleMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateRoleMutation>({ document: CreateRoleDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'createRole', 'mutation', variables);
    },
    UpdateRole(variables: UpdateRoleMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateRoleMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateRoleMutation>({ document: UpdateRoleDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateRole', 'mutation', variables);
    },
    DeleteRole(variables: DeleteRoleMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeleteRoleMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteRoleMutation>({ document: DeleteRoleDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeleteRole', 'mutation', variables);
    },
    GetShift(variables: GetShiftQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetShiftQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetShiftQuery>({ document: GetShiftDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetShift', 'query', variables);
    },
    GetShifts(variables: GetShiftsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetShiftsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetShiftsQuery>({ document: GetShiftsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetShifts', 'query', variables);
    },
    GetEventShifts(variables: GetEventShiftsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetEventShiftsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetEventShiftsQuery>({ document: GetEventShiftsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetEventShifts', 'query', variables);
    },
    GetShiftInstancesByMasterIds(variables: GetShiftInstancesByMasterIdsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetShiftInstancesByMasterIdsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetShiftInstancesByMasterIdsQuery>({ document: GetShiftInstancesByMasterIdsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetShiftInstancesByMasterIds', 'query', variables);
    },
    CreateShift(variables: CreateShiftMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CreateShiftMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateShiftMutation>({ document: CreateShiftDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CreateShift', 'mutation', variables);
    },
    UpdateShift(variables: UpdateShiftMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateShiftMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateShiftMutation>({ document: UpdateShiftDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateShift', 'mutation', variables);
    },
    DuplicateShift(variables: DuplicateShiftMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DuplicateShiftMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DuplicateShiftMutation>({ document: DuplicateShiftDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DuplicateShift', 'mutation', variables);
    },
    DeleteShift(variables: DeleteShiftMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeleteShiftMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteShiftMutation>({ document: DeleteShiftDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeleteShift', 'mutation', variables);
    },
    SetShiftRequiredForms(variables: SetShiftRequiredFormsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SetShiftRequiredFormsMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SetShiftRequiredFormsMutation>({ document: SetShiftRequiredFormsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SetShiftRequiredForms', 'mutation', variables);
    },
    SetShiftInstanceRequiredForms(variables: SetShiftInstanceRequiredFormsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SetShiftInstanceRequiredFormsMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SetShiftInstanceRequiredFormsMutation>({ document: SetShiftInstanceRequiredFormsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SetShiftInstanceRequiredForms', 'mutation', variables);
    },
    UpdateMembersForShiftInstance(variables: UpdateMembersForShiftInstanceMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateMembersForShiftInstanceMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateMembersForShiftInstanceMutation>({ document: UpdateMembersForShiftInstanceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateMembersForShiftInstance', 'mutation', variables);
    },
    UpdateShiftInstance(variables: UpdateShiftInstanceMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateShiftInstanceMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateShiftInstanceMutation>({ document: UpdateShiftInstanceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateShiftInstance', 'mutation', variables);
    },
    DeleteShiftInstance(variables: DeleteShiftInstanceMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeleteShiftInstanceMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteShiftInstanceMutation>({ document: DeleteShiftInstanceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeleteShiftInstance', 'mutation', variables);
    },
    UpdateShiftInstanceApproval(variables: UpdateShiftInstanceApprovalMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateShiftInstanceApprovalMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateShiftInstanceApprovalMutation>({ document: UpdateShiftInstanceApprovalDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateShiftInstanceApproval', 'mutation', variables);
    },
    UpdateShiftInstanceVolunteers(variables: UpdateShiftInstanceVolunteersMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateShiftInstanceVolunteersMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateShiftInstanceVolunteersMutation>({ document: UpdateShiftInstanceVolunteersDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateShiftInstanceVolunteers', 'mutation', variables);
    },
    UpdateShiftInstanceInviteStatus(variables: UpdateShiftInstanceInviteStatusMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateShiftInstanceInviteStatusMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateShiftInstanceInviteStatusMutation>({ document: UpdateShiftInstanceInviteStatusDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateShiftInstanceInviteStatus', 'mutation', variables);
    },
    SendShiftInstanceCallOut(variables: SendShiftInstanceCallOutMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<SendShiftInstanceCallOutMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SendShiftInstanceCallOutMutation>({ document: SendShiftInstanceCallOutDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'SendShiftInstanceCallOut', 'mutation', variables);
    },
    RemindShiftInstanceInvite(variables: RemindShiftInstanceInviteMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<RemindShiftInstanceInviteMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<RemindShiftInstanceInviteMutation>({ document: RemindShiftInstanceInviteDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'RemindShiftInstanceInvite', 'mutation', variables);
    },
    GetShiftInstanceCallOutSummary(variables: GetShiftInstanceCallOutSummaryQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetShiftInstanceCallOutSummaryQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetShiftInstanceCallOutSummaryQuery>({ document: GetShiftInstanceCallOutSummaryDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetShiftInstanceCallOutSummary', 'query', variables);
    },
    GetShiftInstanceCallOutHistory(variables: GetShiftInstanceCallOutHistoryQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetShiftInstanceCallOutHistoryQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetShiftInstanceCallOutHistoryQuery>({ document: GetShiftInstanceCallOutHistoryDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetShiftInstanceCallOutHistory', 'query', variables);
    },
    JoinShiftInstance(variables: JoinShiftInstanceMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<JoinShiftInstanceMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<JoinShiftInstanceMutation>({ document: JoinShiftInstanceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'JoinShiftInstance', 'mutation', variables);
    },
    GetShiftVolunteers(variables: GetShiftVolunteersQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetShiftVolunteersQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetShiftVolunteersQuery>({ document: GetShiftVolunteersDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetShiftVolunteers', 'query', variables);
    },
    GetActiveShiftInstances(variables: GetActiveShiftInstancesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetActiveShiftInstancesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetActiveShiftInstancesQuery>({ document: GetActiveShiftInstancesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetActiveShiftInstances', 'query', variables);
    },
    GetShiftInstances(variables: GetShiftInstancesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetShiftInstancesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetShiftInstancesQuery>({ document: GetShiftInstancesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetShiftInstances', 'query', variables);
    },
    GetShiftInstance(variables: GetShiftInstanceQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetShiftInstanceQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetShiftInstanceQuery>({ document: GetShiftInstanceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetShiftInstance', 'query', variables);
    },
    GetWeeklyShifts(variables: GetWeeklyShiftsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetWeeklyShiftsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetWeeklyShiftsQuery>({ document: GetWeeklyShiftsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetWeeklyShifts', 'query', variables);
    },
    GetPublicShiftInstances(variables: GetPublicShiftInstancesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPublicShiftInstancesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPublicShiftInstancesQuery>({ document: GetPublicShiftInstancesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPublicShiftInstances', 'query', variables);
    },
    GetPublicShiftInstance(variables: GetPublicShiftInstanceQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPublicShiftInstanceQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPublicShiftInstanceQuery>({ document: GetPublicShiftInstanceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPublicShiftInstance', 'query', variables);
    },
    GetMyShiftInstances(variables?: GetMyShiftInstancesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyShiftInstancesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyShiftInstancesQuery>({ document: GetMyShiftInstancesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyShiftInstances', 'query', variables);
    },
    GetAvailableShiftInstances(variables?: GetAvailableShiftInstancesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAvailableShiftInstancesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAvailableShiftInstancesQuery>({ document: GetAvailableShiftInstancesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAvailableShiftInstances', 'query', variables);
    },
    GetAvailableShiftInstanceDayCounts(variables?: GetAvailableShiftInstanceDayCountsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAvailableShiftInstanceDayCountsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAvailableShiftInstanceDayCountsQuery>({ document: GetAvailableShiftInstanceDayCountsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAvailableShiftInstanceDayCounts', 'query', variables);
    },
    CheckIn(variables: CheckInMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CheckInMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CheckInMutation>({ document: CheckInDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CheckIn', 'mutation', variables);
    },
    CheckOut(variables: CheckOutMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CheckOutMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CheckOutMutation>({ document: CheckOutDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CheckOut', 'mutation', variables);
    },
    GetCheckInShiftInstances(variables: GetCheckInShiftInstancesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetCheckInShiftInstancesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetCheckInShiftInstancesQuery>({ document: GetCheckInShiftInstancesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetCheckInShiftInstances', 'query', variables);
    },
    GetCheckInShifts(variables?: GetCheckInShiftsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetCheckInShiftsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetCheckInShiftsQuery>({ document: GetCheckInShiftsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetCheckInShifts', 'query', variables);
    },
    CheckInInviteToShiftInstance(variables: CheckInInviteToShiftInstanceMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CheckInInviteToShiftInstanceMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CheckInInviteToShiftInstanceMutation>({ document: CheckInInviteToShiftInstanceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CheckInInviteToShiftInstance', 'mutation', variables);
    },
    TermsStatus(variables?: TermsStatusQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<TermsStatusQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<TermsStatusQuery>({ document: TermsStatusDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'TermsStatus', 'query', variables);
    },
    AcceptTerms(variables: AcceptTermsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<AcceptTermsMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<AcceptTermsMutation>({ document: AcceptTermsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'AcceptTerms', 'mutation', variables);
    },
    AddTimeEntry(variables: AddTimeEntryMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<AddTimeEntryMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<AddTimeEntryMutation>({ document: AddTimeEntryDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'AddTimeEntry', 'mutation', variables);
    },
    DeleteTimeEntry(variables: DeleteTimeEntryMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<DeleteTimeEntryMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteTimeEntryMutation>({ document: DeleteTimeEntryDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'DeleteTimeEntry', 'mutation', variables);
    },
    CloseTimeEntry(variables: CloseTimeEntryMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CloseTimeEntryMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CloseTimeEntryMutation>({ document: CloseTimeEntryDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CloseTimeEntry', 'mutation', variables);
    },
    GetTimeEntry(variables: GetTimeEntryQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetTimeEntryQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetTimeEntryQuery>({ document: GetTimeEntryDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetTimeEntry', 'query', variables);
    },
    UpdateTimeEntry(variables: UpdateTimeEntryMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateTimeEntryMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateTimeEntryMutation>({ document: UpdateTimeEntryDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateTimeEntry', 'mutation', variables);
    },
    GetTimeEntries(variables: GetTimeEntriesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetTimeEntriesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetTimeEntriesQuery>({ document: GetTimeEntriesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetTimeEntries', 'query', variables);
    },
    GetTimeEntriesByUser(variables: GetTimeEntriesByUserQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetTimeEntriesByUserQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetTimeEntriesByUserQuery>({ document: GetTimeEntriesByUserDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetTimeEntriesByUser', 'query', variables);
    },
    GetMyTime(variables: GetMyTimeQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyTimeQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyTimeQuery>({ document: GetMyTimeDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyTime', 'query', variables);
    },
    GetCheckInContext(variables: GetCheckInContextQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetCheckInContextQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetCheckInContextQuery>({ document: GetCheckInContextDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetCheckInContext', 'query', variables);
    },
    GetCheckInReadiness(variables: GetCheckInReadinessQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetCheckInReadinessQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetCheckInReadinessQuery>({ document: GetCheckInReadinessDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetCheckInReadiness', 'query', variables);
    },
    GetCheckInVolunteerRequiredForms(variables: GetCheckInVolunteerRequiredFormsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetCheckInVolunteerRequiredFormsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetCheckInVolunteerRequiredFormsQuery>({ document: GetCheckInVolunteerRequiredFormsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetCheckInVolunteerRequiredForms', 'query', variables);
    },
    CheckInVolunteer(variables: CheckInVolunteerMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CheckInVolunteerMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CheckInVolunteerMutation>({ document: CheckInVolunteerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CheckInVolunteer', 'mutation', variables);
    },
    CheckInInviteToOrganization(variables: CheckInInviteToOrganizationMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CheckInInviteToOrganizationMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CheckInInviteToOrganizationMutation>({ document: CheckInInviteToOrganizationDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CheckInInviteToOrganization', 'mutation', variables);
    },
    CheckOutVolunteer(variables: CheckOutVolunteerMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CheckOutVolunteerMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CheckOutVolunteerMutation>({ document: CheckOutVolunteerDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CheckOutVolunteer', 'mutation', variables);
    },
    GetMe(variables?: GetMeQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMeQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMeQuery>({ document: GetMeDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMe', 'query', variables);
    },
    GetUser(variables: GetUserQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetUserQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetUserQuery>({ document: GetUserDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetUser', 'query', variables);
    },
    GetMyPermissions(variables?: GetMyPermissionsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyPermissionsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyPermissionsQuery>({ document: GetMyPermissionsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyPermissions', 'query', variables);
    },
    GetMyOrganizations(variables: GetMyOrganizationsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMyOrganizationsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMyOrganizationsQuery>({ document: GetMyOrganizationsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMyOrganizations', 'query', variables);
    },
    UpdateMyLocale(variables: UpdateMyLocaleMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateMyLocaleMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateMyLocaleMutation>({ document: UpdateMyLocaleDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateMyLocale', 'mutation', variables);
    },
    UpdateMyImage(variables: UpdateMyImageMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateMyImageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateMyImageMutation>({ document: UpdateMyImageDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateMyImage', 'mutation', variables);
    },
    UpdateMyAccountSettings(variables: UpdateMyAccountSettingsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateMyAccountSettingsMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateMyAccountSettingsMutation>({ document: UpdateMyAccountSettingsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateMyAccountSettings', 'mutation', variables);
    },
    UnsubscribeFromEmails(variables?: UnsubscribeFromEmailsMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UnsubscribeFromEmailsMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UnsubscribeFromEmailsMutation>({ document: UnsubscribeFromEmailsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UnsubscribeFromEmails', 'mutation', variables);
    },
    UpdateMyProfile(variables: UpdateMyProfileMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateMyProfileMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateMyProfileMutation>({ document: UpdateMyProfileDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateMyProfile', 'mutation', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;