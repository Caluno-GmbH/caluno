import { describe, expect, it } from 'bun:test';
import {
  isYourActionStatus,
  STATUS_META,
} from './reimbursements-volunteer-group';

describe('contract-expired status', () => {
  // A completed contract whose period has ended (e.g. an individual time
  // frame) must not offer a create action or count as an org task.
  it('has no action button', () => {
    expect(STATUS_META['contract-expired'].actionKey).toBeNull();
  });

  it('is not an action for the org', () => {
    expect(isYourActionStatus('contract-expired')).toBe(false);
  });
});
