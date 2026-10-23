import { registerEnumType } from '@nestjs/graphql';
import { FieldType, RequiredFormTargetType } from './index';

registerEnumType(FieldType, {
  name: 'FieldType',
});

registerEnumType(RequiredFormTargetType, {
  name: 'RequiredFormTargetType',
});
