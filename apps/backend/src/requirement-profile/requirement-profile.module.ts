import { Module } from '@nestjs/common';
import './enums/register-graphql-enums';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { MembershipMapper } from '../membership/mappers/membership.mepper';
import { MembershipRequestMapper } from '../membership/mappers/membership-request.mepper';
import { OrganizationUnitDataModule } from '../organization/organization-unit-data.module';
import { SharedModule } from '../shared/shared.module';
import { StorageModule } from '../storage/storage.module';
import { UserModule } from '../user/user.module';
import { FormBlockMapper } from './mappers/form-block.mapper';
import { FormBlockFieldMapper } from './mappers/form-block-field.mapper';
import { FormSubmissionMapper } from './mappers/form-submission.mapper';
import { FormSubmissionValueMapper } from './mappers/form-submission-value.mapper';
import { OrganizationUserProfileMapper } from './mappers/organization-user-profile.mapper';
import { RequiredFormRefMapper } from './mappers/required-form-ref.mapper';
import { RequirementFormMapper } from './mappers/requirement-form.mapper';
import { RequirementFormBlockRefMapper } from './mappers/requirement-form-block-ref.mapper';
import { FormBlockFieldResolver } from './resolvers/form-block-field.resolver';
import { FormBlockFieldDocumentResolver } from './resolvers/form-block-field-document.resolver';
import { FormBlockMutationResolver } from './resolvers/form-block-mutation.resolver';
import { FormBlockQueryResolver } from './resolvers/form-block-query.resolver';
import { FormSubmissionFieldResolver } from './resolvers/form-submission-field.resolver';
import { FormSubmissionQueryResolver } from './resolvers/form-submission-query.resolver';
import { RequirementFormBlockRefFieldResolver } from './resolvers/requirement-form-block-ref-field.resolver';
import { RequirementFormFieldResolver } from './resolvers/requirement-form-field.resolver';
import { RequirementFormMutationResolver } from './resolvers/requirement-form-mutation.resolver';
import { RequirementFormQueryResolver } from './resolvers/requirement-form-query.resolver';
import {
  FormBlockService,
  FormSubmissionService,
  RequiredFormService,
  RequirementFormService,
} from './services';
import {
  EventRequiredFormTargetStrategy,
  OrganizationUnitRequiredFormTargetStrategy,
  RequiredFormTargetRegistry,
  RequiredFormWriteSupport,
  ShiftInstanceRequiredFormTargetStrategy,
  ShiftRequiredFormTargetStrategy,
} from './targets';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    OrganizationUnitDataModule,
    SharedModule,
    UserModule,
    StorageModule,
  ],
  providers: [
    FormBlockService,
    RequirementFormService,
    FormSubmissionService,
    RequiredFormService,
    RequiredFormWriteSupport,
    OrganizationUnitRequiredFormTargetStrategy,
    EventRequiredFormTargetStrategy,
    ShiftRequiredFormTargetStrategy,
    ShiftInstanceRequiredFormTargetStrategy,
    RequiredFormTargetRegistry,
    MembershipMapper,
    MembershipRequestMapper,
    OrganizationUserProfileMapper,
    FormBlockMapper,
    FormBlockFieldMapper,
    RequirementFormMapper,
    RequirementFormBlockRefMapper,
    RequiredFormRefMapper,
    FormSubmissionMapper,
    FormSubmissionValueMapper,
    FormBlockQueryResolver,
    FormBlockMutationResolver,
    FormBlockFieldResolver,
    FormBlockFieldDocumentResolver,
    RequirementFormQueryResolver,
    RequirementFormMutationResolver,
    RequirementFormFieldResolver,
    RequirementFormBlockRefFieldResolver,
    FormSubmissionQueryResolver,
    FormSubmissionFieldResolver,
  ],
  exports: [
    FormBlockService,
    RequirementFormService,
    FormSubmissionService,
    RequiredFormService,
    RequiredFormRefMapper,
  ],
})
export class RequirementProfileModule {}
