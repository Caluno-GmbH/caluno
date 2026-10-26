import { BadRequestGraphQLError } from '../../graphql/errors';

/** A closed time entry must end strictly after it starts. */
export function assertEndAfterStart(
  startedAt: Date,
  endedAt: Date | null | undefined,
): void {
  if (endedAt && endedAt.getTime() <= startedAt.getTime()) {
    throw new BadRequestGraphQLError('Time entry must end after it starts');
  }
}

/** An entry tied to a shift instance cannot start after that shift has ended. */
export function assertStartNotAfterShiftEnd(
  startedAt: Date,
  actualEndsAt: Date,
): void {
  if (startedAt.getTime() > actualEndsAt.getTime()) {
    throw new BadRequestGraphQLError(
      'Check-in cannot be later than the shift end',
    );
  }
}
