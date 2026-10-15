import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import { BadRequestGraphQLError } from '../../graphql/errors/bad-request.error';
import { TodoFillThreshold } from '../enums/todo-fill-threshold.enum';
import type { TodoFillAssignmentFilter } from '../models/todo-fill-filter.model';
import {
  DEFAULT_FILL_ASSIGNMENT_FILTER,
  type FillAssignmentFilter,
  isFillAssignmentDays,
  isFillAssignmentThreshold,
} from './todo-fill-filter';

@Injectable()
export class TodoFillFilterService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async get(
    userId: string,
    organizationUnitId: string,
  ): Promise<FillAssignmentFilter> {
    const [row] = await this.db
      .select({
        threshold: schema.todoFillFilters.threshold,
        daysAhead: schema.todoFillFilters.daysAhead,
      })
      .from(schema.todoFillFilters)
      .where(
        and(
          eq(schema.todoFillFilters.userId, userId),
          eq(schema.todoFillFilters.organizationUnitId, organizationUnitId),
        ),
      )
      .limit(1);

    if (!row) return DEFAULT_FILL_ASSIGNMENT_FILTER;
    return normalizeFillFilter(row.threshold, row.daysAhead);
  }

  async update(
    userId: string,
    organizationUnitId: string,
    input: TodoFillAssignmentFilter,
  ): Promise<FillAssignmentFilter> {
    if (
      !isFillAssignmentThreshold(input.threshold) ||
      !isFillAssignmentDays(input.daysAhead)
    ) {
      throw new BadRequestGraphQLError(
        'Choose a staffing threshold and 7, 14, or 30 days.',
      );
    }

    await this.db
      .insert(schema.todoFillFilters)
      .values({
        userId,
        organizationUnitId,
        threshold: input.threshold,
        daysAhead: input.daysAhead,
      })
      .onConflictDoUpdate({
        target: [
          schema.todoFillFilters.userId,
          schema.todoFillFilters.organizationUnitId,
        ],
        set: {
          threshold: input.threshold,
          daysAhead: input.daysAhead,
        },
      });

    return {
      threshold: input.threshold,
      daysAhead: input.daysAhead,
    };
  }
}

function normalizeFillFilter(
  threshold: string,
  daysAhead: number,
): FillAssignmentFilter {
  return {
    threshold: isFillAssignmentThreshold(threshold)
      ? threshold
      : TodoFillThreshold.BELOW_MINIMUM,
    daysAhead: isFillAssignmentDays(daysAhead) ? daysAhead : 14,
  };
}
