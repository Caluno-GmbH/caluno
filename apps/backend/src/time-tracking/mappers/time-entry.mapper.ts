import { plainToInstance } from 'class-transformer';
import { Mapper } from '../../shared/decorators/mapper.decorator';
import { BaseMapper } from '../../shared/mapper';
import { TimeEntry } from '../models/time-entry.model';
import type { TimeEntryEntity } from '../schemas/time-entry.schema';
import { deriveTimeEntryStatus } from '../utils/time-entry-status';

@Mapper({ model: TimeEntry })
export class TimeEntryMapper extends BaseMapper<TimeEntry, TimeEntryEntity> {
  override toModel(
    entity: TimeEntryEntity | null | undefined,
  ): TimeEntry | null {
    if (!entity) {
      return null;
    }
    return plainToInstance(
      this.modelClass,
      { ...entity, status: deriveTimeEntryStatus(entity) },
      { excludeExtraneousValues: false },
    );
  }
}
