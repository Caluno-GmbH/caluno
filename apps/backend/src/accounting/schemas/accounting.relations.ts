import { defineRelationsPart } from 'drizzle-orm';
import * as schema from '../../database/schema';

export const accountingRelations = defineRelationsPart(schema, (r) => ({
  reimbursementTypes: {
    rates: r.many.reimbursementRates({
      from: r.reimbursementTypes.id,
      to: r.reimbursementRates.reimbursementTypeId,
    }),
    documentTemplates: r.many.documentTemplates({
      from: r.reimbursementTypes.id,
      to: r.documentTemplates.reimbursementTypeId,
    }),
    contracts: r.many.contracts({
      from: r.reimbursementTypes.id,
      to: r.contracts.reimbursementTypeId,
    }),
    invoices: r.many.invoices({
      from: r.reimbursementTypes.id,
      to: r.invoices.reimbursementTypeId,
    }),
  },
  reimbursementRates: {
    organization: r.one.organizations({
      from: r.reimbursementRates.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    reimbursementType: r.one.reimbursementTypes({
      from: r.reimbursementRates.reimbursementTypeId,
      to: r.reimbursementTypes.id,
      optional: false,
    }),
  },
  documentTemplates: {
    organization: r.one.organizations({
      from: r.documentTemplates.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    organizationUnit: r.one.organizationUnits({
      from: r.documentTemplates.organizationUnitId,
      to: r.organizationUnits.id,
    }),
    reimbursementType: r.one.reimbursementTypes({
      from: r.documentTemplates.reimbursementTypeId,
      to: r.reimbursementTypes.id,
      optional: false,
    }),
    lastEditedByUser: r.one.users({
      from: r.documentTemplates.lastEditedBy,
      to: r.users.id,
    }),
    signees: r.many.templateSignees({
      from: r.documentTemplates.id,
      to: r.templateSignees.documentTemplateId,
    }),
    contracts: r.many.contracts({
      from: r.documentTemplates.id,
      to: r.contracts.documentTemplateId,
    }),
    invoices: r.many.invoices({
      from: r.documentTemplates.id,
      to: r.invoices.documentTemplateId,
    }),
  },
  templateSignees: {
    documentTemplate: r.one.documentTemplates({
      from: r.templateSignees.documentTemplateId,
      to: r.documentTemplates.id,
      optional: false,
    }),
    requiredPermission: r.one.permissions({
      from: r.templateSignees.requiredPermissionId,
      to: r.permissions.id,
    }),
  },
  contracts: {
    documentTemplate: r.one.documentTemplates({
      from: r.contracts.documentTemplateId,
      to: r.documentTemplates.id,
      optional: false,
    }),
    volunteer: r.one.users({
      from: r.contracts.volunteerId,
      to: r.users.id,
      optional: false,
    }),
    organizationUnit: r.one.organizationUnits({
      from: r.contracts.organizationUnitId,
      to: r.organizationUnits.id,
    }),
    reimbursementType: r.one.reimbursementTypes({
      from: r.contracts.reimbursementTypeId,
      to: r.reimbursementTypes.id,
      optional: false,
    }),
    declinedByUser: r.one.users({
      from: r.contracts.declinedByUserId,
      to: r.users.id,
    }),
    signatures: r.many.contractSignatures({
      from: r.contracts.id,
      to: r.contractSignatures.contractId,
    }),
    statusChanges: r.many.contractStatusChanges({
      from: r.contracts.id,
      to: r.contractStatusChanges.contractId,
    }),
  },
  invoices: {
    documentTemplate: r.one.documentTemplates({
      from: r.invoices.documentTemplateId,
      to: r.documentTemplates.id,
      optional: false,
    }),
    volunteer: r.one.users({
      from: r.invoices.volunteerId,
      to: r.users.id,
      optional: false,
    }),
    organizationUnit: r.one.organizationUnits({
      from: r.invoices.organizationUnitId,
      to: r.organizationUnits.id,
    }),
    reimbursementType: r.one.reimbursementTypes({
      from: r.invoices.reimbursementTypeId,
      to: r.reimbursementTypes.id,
      optional: false,
    }),
    declinedByUser: r.one.users({
      from: r.invoices.declinedByUserId,
      to: r.users.id,
    }),
    signatures: r.many.invoiceSignatures({
      from: r.invoices.id,
      to: r.invoiceSignatures.invoiceId,
    }),
    statusChanges: r.many.invoiceStatusChanges({
      from: r.invoices.id,
      to: r.invoiceStatusChanges.invoiceId,
    }),
    invoiceTimeEntries: r.many.invoiceTimeEntries({
      from: r.invoices.id,
      to: r.invoiceTimeEntries.invoiceId,
    }),
  },
  contractSignatures: {
    contract: r.one.contracts({
      from: r.contractSignatures.contractId,
      to: r.contracts.id,
      optional: false,
    }),
    requiredPermission: r.one.permissions({
      from: r.contractSignatures.requiredPermissionId,
      to: r.permissions.id,
    }),
    signedByUser: r.one.users({
      from: r.contractSignatures.signedByUserId,
      to: r.users.id,
    }),
  },
  invoiceSignatures: {
    invoice: r.one.invoices({
      from: r.invoiceSignatures.invoiceId,
      to: r.invoices.id,
      optional: false,
    }),
    requiredPermission: r.one.permissions({
      from: r.invoiceSignatures.requiredPermissionId,
      to: r.permissions.id,
    }),
    signedByUser: r.one.users({
      from: r.invoiceSignatures.signedByUserId,
      to: r.users.id,
    }),
  },
  contractStatusChanges: {
    contract: r.one.contracts({
      from: r.contractStatusChanges.contractId,
      to: r.contracts.id,
      optional: false,
    }),
    actorUser: r.one.users({
      from: r.contractStatusChanges.actorUserId,
      to: r.users.id,
    }),
  },
  invoiceStatusChanges: {
    invoice: r.one.invoices({
      from: r.invoiceStatusChanges.invoiceId,
      to: r.invoices.id,
      optional: false,
    }),
    actorUser: r.one.users({
      from: r.invoiceStatusChanges.actorUserId,
      to: r.users.id,
    }),
  },
  invoiceTimeEntries: {
    invoice: r.one.invoices({
      from: r.invoiceTimeEntries.invoiceId,
      to: r.invoices.id,
      optional: false,
    }),
    timeEntry: r.one.timeEntries({
      from: r.invoiceTimeEntries.timeEntryId,
      to: r.timeEntries.id,
      optional: false,
    }),
  },
  reimbursementBundleDownloads: {
    volunteer: r.one.users({
      from: r.reimbursementBundleDownloads.volunteerId,
      to: r.users.id,
      optional: false,
    }),
    reimbursementType: r.one.reimbursementTypes({
      from: r.reimbursementBundleDownloads.reimbursementTypeId,
      to: r.reimbursementTypes.id,
      optional: false,
    }),
    downloadedByUser: r.one.users({
      from: r.reimbursementBundleDownloads.downloadedByUserId,
      to: r.users.id,
    }),
  },
  reimbursementManualBaselines: {
    organization: r.one.organizations({
      from: r.reimbursementManualBaselines.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    volunteer: r.one.users({
      from: r.reimbursementManualBaselines.volunteerId,
      to: r.users.id,
      optional: false,
    }),
    reimbursementType: r.one.reimbursementTypes({
      from: r.reimbursementManualBaselines.reimbursementTypeId,
      to: r.reimbursementTypes.id,
      optional: false,
    }),
    updatedByUser: r.one.users({
      from: r.reimbursementManualBaselines.updatedByUserId,
      to: r.users.id,
    }),
  },
}));
