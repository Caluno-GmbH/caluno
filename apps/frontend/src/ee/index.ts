import type { EeExtensions } from '@/edition/ee-extensions';

/**
 * EE frontend extensions manifest. `loadEeExtensions()`
 * (`@/edition/load-ee-extensions`) dynamically imports this module when the
 * edition flag is set. A new EE nav item or UI slot is added here only —
 * `dashboard-sidebar.tsx` and page/slot call sites never change.
 */
export const eeExtensions: EeExtensions = {
  navItems: [
    {
      titleKey: 'myNote',
      href: '/my-note',
      icon: 'notebook-pen',
    },
  ],
  slots: {
    'profile-note': () =>
      import('./note/profile-note-section').then((m) => m.ProfileNoteSection),
    'my-note-page': () =>
      import('./note/admin-my-note-page').then((m) => m.AdminMyNotePage),
  },
};
