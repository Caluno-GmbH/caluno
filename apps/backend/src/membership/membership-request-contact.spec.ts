import { describe, expect, it } from 'bun:test';
import {
  adminContactFromUser,
  hasConfiguredOrgUnitContact,
  orgUnitContactFromEntity,
  orgUnitWelcomeContactFromEntity,
} from './membership-request-contact';

describe('membership-request-contact', () => {
  it('detects configured org-unit contact when any field is set', () => {
    expect(
      hasConfiguredOrgUnitContact({
        contactPersonName: null,
        contactEmail: 'help@example.org',
        phone: null,
      }),
    ).toBe(true);

    expect(
      hasConfiguredOrgUnitContact({
        contactPersonName: '  ',
        contactEmail: null,
        phone: null,
      }),
    ).toBe(false);
  });

  it('maps org-unit contact fields without admin fallback', () => {
    expect(
      orgUnitContactFromEntity({
        contactPersonName: ' Alex ',
        contactEmail: 'alex@example.org',
        phone: '+49 30 123',
      }),
    ).toEqual({
      name: 'Alex',
      email: 'alex@example.org',
      phone: '+49 30 123',
    });
  });

  it('maps admin fallback contact from user', () => {
    expect(
      adminContactFromUser({
        name: 'Admin User',
        email: 'admin@example.org',
      }),
    ).toEqual({
      name: 'Admin User',
      email: 'admin@example.org',
      phone: null,
    });
  });

  it('maps welcome email contact payload from org unit', () => {
    expect(
      orgUnitWelcomeContactFromEntity({
        contactPersonName: 'Sam',
        contactEmail: 'sam@example.org',
        phone: null,
        welcomeMessage: 'Glad to have you!',
      }),
    ).toEqual({
      contactPersonName: 'Sam',
      contactEmail: 'sam@example.org',
      phone: null,
      welcomeMessage: 'Glad to have you!',
    });
  });
});
