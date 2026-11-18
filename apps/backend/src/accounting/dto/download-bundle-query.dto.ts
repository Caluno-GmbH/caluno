import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ReimbursementTypeKey } from '../enums';

/** Far above what one volunteer has ready; keeps the list and the query bounded. */
export const MAX_NAMED_INVOICES = 100;

export class DownloadBundleQueryDto {
  /** A better auth user id, which is not a uuid. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  volunteerId!: string;

  @IsEnum(ReimbursementTypeKey)
  reimbursementTypeId!: ReimbursementTypeKey;

  /**
   * The timesheets the board shows, as a comma separated list. Left out, every
   * READY timesheet of the volunteer and type is bundled.
   */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value !== '' ? value.split(',') : undefined,
  )
  @IsArray()
  @ArrayMaxSize(MAX_NAMED_INVOICES)
  @IsUUID('all', { each: true })
  invoiceIds?: string[];
}
