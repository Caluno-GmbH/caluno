import { defineRelationsPart } from 'drizzle-orm';
import * as schema from '../../database/schema';

export const requirementProfilesRelations = defineRelationsPart(
  schema,
  (r) => ({
    organizationUserProfiles: {
      organization: r.one.organizations({
        from: r.organizationUserProfiles.organizationId,
        to: r.organizations.id,
        optional: false,
      }),
      user: r.one.users({
        from: r.organizationUserProfiles.userId,
        to: r.users.id,
        optional: false,
      }),
      storedFormSubmissionValues: r.many.formSubmissionValues({
        from: r.organizationUserProfiles.id,
        to: r.formSubmissionValues.organizationUserProfileId,
      }),
    },
    formBlocks: {
      organization: r.one.organizations({
        from: r.formBlocks.organizationId,
        to: r.organizations.id,
        optional: false,
      }),
      createdByUser: r.one.users({
        from: r.formBlocks.createdBy,
        to: r.users.id,
        optional: false,
      }),
      updatedByUser: r.one.users({
        from: r.formBlocks.updatedBy,
        to: r.users.id,
        optional: false,
      }),
      fields: r.many.formBlockFields({
        from: r.formBlocks.id,
        to: r.formBlockFields.blockId,
      }),
      formRefs: r.many.requirementFormBlockRefs({
        from: r.formBlocks.id,
        to: r.requirementFormBlockRefs.blockId,
      }),
    },
    formBlockFields: {
      block: r.one.formBlocks({
        from: r.formBlockFields.blockId,
        to: r.formBlocks.id,
        optional: false,
      }),
    },
    requirementForms: {
      organization: r.one.organizations({
        from: r.requirementForms.organizationId,
        to: r.organizations.id,
        optional: false,
      }),
      createdByUser: r.one.users({
        from: r.requirementForms.createdBy,
        to: r.users.id,
        optional: false,
      }),
      updatedByUser: r.one.users({
        from: r.requirementForms.updatedBy,
        to: r.users.id,
        optional: false,
      }),
      blockRefs: r.many.requirementFormBlockRefs({
        from: r.requirementForms.id,
        to: r.requirementFormBlockRefs.formId,
      }),
      submissions: r.many.formSubmissions({
        from: r.requirementForms.id,
        to: r.formSubmissions.formId,
      }),
    },
    requirementFormBlockRefs: {
      form: r.one.requirementForms({
        from: r.requirementFormBlockRefs.formId,
        to: r.requirementForms.id,
        optional: false,
      }),
      block: r.one.formBlocks({
        from: r.requirementFormBlockRefs.blockId,
        to: r.formBlocks.id,
        optional: false,
      }),
    },
    formSubmissions: {
      form: r.one.requirementForms({
        from: r.formSubmissions.formId,
        to: r.requirementForms.id,
        optional: false,
      }),
      user: r.one.users({
        from: r.formSubmissions.userId,
        to: r.users.id,
        optional: false,
      }),
      organizationUnit: r.one.organizationUnits({
        from: r.formSubmissions.organizationUnitId,
        to: r.organizationUnits.id,
        optional: false,
      }),
      values: r.many.formSubmissionValues({
        from: r.formSubmissions.id,
        to: r.formSubmissionValues.submissionId,
      }),
    },
    formSubmissionValues: {
      submission: r.one.formSubmissions({
        from: r.formSubmissionValues.submissionId,
        to: r.formSubmissions.id,
        optional: false,
      }),
      field: r.one.formBlockFields({
        from: r.formSubmissionValues.fieldId,
        to: r.formBlockFields.id,
        optional: false,
      }),
      organizationUserProfile: r.one.organizationUserProfiles({
        from: r.formSubmissionValues.organizationUserProfileId,
        to: r.organizationUserProfiles.id,
      }),
    },
  }),
);
