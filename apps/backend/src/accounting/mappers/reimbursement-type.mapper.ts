import { Mapper } from '../../shared/decorators/mapper.decorator';
import { BaseMapper } from '../../shared/mapper';
import { ReimbursementType } from '../models/reimbursement-type.model';
import type { ReimbursementTypeEntity } from '../schemas/reimbursement-type.schema';

@Mapper({ model: ReimbursementType })
export class ReimbursementTypeMapper extends BaseMapper<
  ReimbursementType,
  ReimbursementTypeEntity
> {
  // The key is the primary key; the GraphQL `id` mirrors it.
  override toModel(
    entity: ReimbursementTypeEntity | null | undefined,
  ): ReimbursementType | null {
    const model = super.toModel(entity);
    if (model && entity) model.id = entity.key;
    return model;
  }
}
