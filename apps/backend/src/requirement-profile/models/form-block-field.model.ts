import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { FieldType } from '../enums';

registerEnumType(FieldType, {
  name: 'FieldType',
});

@ObjectType()
export class SelectOption {
  @Field(() => String)
  label!: string;

  @Field(() => String)
  value!: string;
}

@ObjectType()
export class FormBlockFieldDocument {
  @Field(() => String)
  fileId!: string;

  @Field(() => String, { nullable: true })
  filename?: string | null;

  @Field(() => String, { nullable: true })
  downloadUrl?: string | null;
}

@ObjectType()
export class FormBlockField {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  blockId!: string;

  @Field(() => FieldType)
  type!: FieldType;

  @Field(() => String)
  label!: string;

  @Field(() => String, { nullable: true })
  placeholder?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Boolean)
  required!: boolean;

  @Field(() => Boolean)
  lockType!: boolean;

  @Field(() => String, { nullable: true })
  systemKey?: string | null;

  @Field(() => [SelectOption], { nullable: true })
  options?: SelectOption[] | null;

  // filled from the entity during mapping. But not exposed to clients. Converted to FormBlockFieldDocument in resolver
  documentFileIds?: string[] | null;

  @Field(() => String, { nullable: true })
  documentLabel?: string | null;

  @Field(() => [FormBlockFieldDocument])
  documents?: FormBlockFieldDocument[];

  @Field(() => Number, { nullable: true })
  minAge?: number | null;

  @Field(() => Number)
  fieldOrder!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
