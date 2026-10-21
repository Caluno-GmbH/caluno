export const TEST_PASSWORD = 'E2eCheck-7v#Lm9';

// Unique per run so each run gets a fresh account.
export const uniqueEmail = () =>
  `e2e+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
