import { hasEeEdition } from './has-ee-edition';

/** Renders the EE profile note when the edition is enabled; otherwise nothing. */
export async function ProfileNoteSlot() {
  if (!hasEeEdition()) {
    return null;
  }

  const { ProfileNoteSection } = await import(
    /* webpackIgnore: true */ '../ee/note/profile-note-section'
  );
  return <ProfileNoteSection />;
}
