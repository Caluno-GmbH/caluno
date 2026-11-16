import { Mapper } from '../../shared/decorators/mapper.decorator';
import { BaseMapper } from '../../shared/mapper';
import { ExportLogEntry } from '../models/export.model';
import type { ExportLogEntity } from '../schemas/export-log.schema';

@Mapper({ model: ExportLogEntry })
export class ExportLogMapper extends BaseMapper<
  ExportLogEntry,
  ExportLogEntity
> {
  override toModel(
    entity: ExportLogEntity | null | undefined,
    actorName?: string,
  ): ExportLogEntry | null {
    const model = super.toModel(entity);
    if (!model || !entity) {
      return null;
    }
    model.actorName = actorName ?? entity.actorUserId ?? 'Unknown';
    return model;
  }
}
