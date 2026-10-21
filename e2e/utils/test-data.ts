export const TEST_PASSWORD = 'qewr123ee';

// Unique per run so each run gets a fresh account.
export const uniqueEmail = () =>
  `e2e+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
