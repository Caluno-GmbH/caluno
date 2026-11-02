/** Minimal EE note API surface — implementation lives under `src/ee/` when present. */
export type UserNoteDto = {
  id: string;
  body: string;
  updatedAt: string | Date;
};

export interface NoteApi {
  getMyNote(): Promise<UserNoteDto>;
  updateMyNote(input: { body: string }): Promise<UserNoteDto>;
}
