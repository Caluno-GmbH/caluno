const CHECK_IN_TAB = 'check_in_tab';

export type CheckInTab = 'qr' | 'scanner';

// Best-effort: storage can throw (blocked or sandboxed browser), and a
// failure here must not break the check-in page — it just falls back to the
// default "My QR-code" tab.
export const getCheckInTabPreference = (): CheckInTab | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(CHECK_IN_TAB);
    return value === 'qr' || value === 'scanner' ? value : null;
  } catch (error) {
    console.error('Failed to read check-in tab preference', error);
    return null;
  }
};

export const setCheckInTabPreference = (tab: CheckInTab): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CHECK_IN_TAB, tab);
  } catch (error) {
    console.error('Failed to store check-in tab preference', error);
  }
};
