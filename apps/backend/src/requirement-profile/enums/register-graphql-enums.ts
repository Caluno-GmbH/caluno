import { registerEnumType } from '@nestjs/graphql';
import {
  FieldType,
  OrganizationUserProfileStatus,
  RequiredFormTargetType,
} from './index';

registerEnumType(OrganizationUserProfileStatus, {
  name: 'OrganizationUserProfileStatus',
});

registerEnumType(FieldType, {
  name: 'FieldType',
});

registerEnumType(RequiredFormTargetType, {
  name: 'RequiredFormTargetType',
});
