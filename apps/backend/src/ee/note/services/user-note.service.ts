import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../../database/database.module';
import { DATABASE_CONNECTION } from '../../../database/database-connection';
import { type UserNoteEntity, userNotes } from '../schemas/user-note.schema';

@Injectable()
export class UserNoteService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async getForUser(userId: string): Promise<UserNoteEntity> {
    const [existing] = await this.db
      .select()
      .from(userNotes)
      .where(eq(userNotes.userId, userId))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [created] = await this.db
      .insert(userNotes)
      .values({ userId, body: '' })
      .onConflictDoNothing({ target: userNotes.userId })
      .returning();

    if (created) {
      return created;
    }

    const [retry] = await this.db
      .select()
      .from(userNotes)
      .where(eq(userNotes.userId, userId))
      .limit(1);

    if (!retry) {
      throw new Error(`Failed to load or create user note for ${userId}`);
    }
    return retry;
  }

  async updateForUser(userId: string, body: string): Promise<UserNoteEntity> {
    const [upserted] = await this.db
      .insert(userNotes)
      .values({ userId, body })
      .onConflictDoUpdate({
        target: userNotes.userId,
        set: { body },
      })
      .returning();

    if (!upserted) {
      throw new Error(`Failed to update user note for ${userId}`);
    }
    return upserted;
  }
}
