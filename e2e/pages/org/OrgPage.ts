import { expect, type Page } from '@playwright/test';
import { BASE_URL } from '../AuthPage';

const ORG_DASHBOARD = /\/admin\/[0-9a-f-]{36}/;
const ORG_UNIT_EDIT_SHEET = 'org-unit-create-edit-form';

export class OrgPage {
  constructor(private readonly page: Page) {}

  get getStartedButton() {
    return this.page.getByRole('button', { name: 'Get started' });
  }

  get formDialog() {
    return this.page.getByRole('dialog');
  }

  get nameInput() {
    return this.page.locator('#name');
  }

  get descriptionInput() {
    return this.page.locator('#description');
  }

  get createButton() {
    return this.page.getByRole('button', { name: 'Create organisation' });
  }

  get saveButton() {
    return this.formDialog.getByRole('button', { name: 'Save changes' });
  }

  get editButton() {
    return this.page.getByRole('button', { name: 'Edit' }).first();
  }

  get nameValidationError() {
    return this.formDialog.getByText('Name must be at least 2 characters');
  }

  // Onboarding entry for org-less accounts.
  async gotoOnboarding() {
    await this.page.goto(`${BASE_URL}/en/admin`, { waitUntil: 'load' });
  }

  async gotoCreate() {
    await this.page.goto(`${BASE_URL}/en/admin/create-organization`, {
      waitUntil: 'load',
    });
  }

  async gotoSettings(orgUId: string) {
    await this.page.goto(`${BASE_URL}/en/admin/${orgUId}/settings/org-units`, {
      waitUntil: 'load',
    });
  }

  // Opens the org-unit edit sheet on the settings page (query-param handshake).
  async gotoEditSettings(orgUId: string) {
    await this.page.goto(
      `${BASE_URL}/en/admin/${orgUId}/settings/org-units?sheet=${ORG_UNIT_EDIT_SHEET}&id=${orgUId}`,
      { waitUntil: 'load' },
    );
    await expect(this.formDialog).toBeVisible();
    await expect(this.nameInput).toBeVisible();
  }

  // The "Get started" click can be dropped before hydration, so retry it.
  async startCreation() {
    await expect(this.getStartedButton).toBeVisible();
    await expect(async () => {
      if (/\/admin\/create-organization/.test(this.page.url())) return;
      await this.getStartedButton.click();
      await this.page.waitForURL(/\/admin\/create-organization/, {
        timeout: 4000,
      });
    }).toPass({ timeout: 20000 });
  }

  // Creates an org and returns its UID from the dashboard URL.
  async createOrganization(name: string): Promise<string> {
    await expect(this.nameInput).toBeVisible();
    await this.nameInput.fill(name);
    await this.createButton.click();
    await this.page.waitForURL(ORG_DASHBOARD);
    const match = this.page.url().match(/\/admin\/([0-9a-f-]{36})/);
    if (!match)
      throw new Error(`Org dashboard URL not matched: ${this.page.url()}`);
    return match[1];
  }

  async expectDashboard(name: string) {
    await expect(this.page).toHaveURL(ORG_DASHBOARD);
    await expect(this.page.getByRole('heading', { name })).toBeVisible();
  }

  get contactPersonNameInput() {
    return this.page.locator('#contactPersonName');
  }

  get contactEmailInput() {
    return this.page.locator('#contactEmail');
  }

  get phoneInput() {
    return this.page.locator('#phone');
  }

  get welcomeMessageInput() {
    return this.page.locator('#welcomeMessage');
  }

  get websiteUrlInput() {
    // Create form uses #websiteUrl; edit sheet uses #website.
    return this.page.locator('#website, #websiteUrl');
  }

  get streetInput() {
    return this.page.locator('#street');
  }

  get zipCodeInput() {
    return this.page.locator('#zipCode');
  }

  get cityInput() {
    return this.page.locator('#city');
  }

  get legalRepInput() {
    return this.page.locator('#legalRep');
  }

  async submit() {
    const save = this.saveButton;
    if (await save.isVisible()) {
      await save.click();
      return;
    }
    await this.createButton.click();
  }

  // Fills only the provided fields; leaves the rest untouched.
  async fillForm(values: {
    name?: string;
    description?: string;
    contactPersonName?: string;
    contactEmail?: string;
    phone?: string;
    welcomeMessage?: string;
    websiteUrl?: string;
    street?: string;
    zipCode?: string;
    city?: string;
    legalRep?: string;
  }) {
    if (values.name !== undefined) await this.nameInput.fill(values.name);
    if (values.description !== undefined) {
      await this.descriptionInput.fill(values.description);
    }
    if (values.contactPersonName !== undefined) {
      await this.contactPersonNameInput.fill(values.contactPersonName);
    }
    if (values.contactEmail !== undefined) {
      await this.contactEmailInput.fill(values.contactEmail);
    }
    if (values.phone !== undefined) await this.phoneInput.fill(values.phone);
    if (values.welcomeMessage !== undefined) {
      await this.welcomeMessageInput.fill(values.welcomeMessage);
    }
    if (values.websiteUrl !== undefined) {
      await this.websiteUrlInput.fill(values.websiteUrl);
    }
    if (values.street !== undefined) {
      await this.streetInput.fill(values.street);
    }
    if (values.zipCode !== undefined) {
      await this.zipCodeInput.fill(values.zipCode);
    }
    if (values.city !== undefined) {
      await this.cityInput.fill(values.city);
    }
    if (values.legalRep !== undefined) {
      await this.legalRepInput.fill(values.legalRep);
    }
  }

  private fieldLocator(
    field: 'name' | 'contactEmail' | 'phone' | 'websiteUrl',
  ) {
    switch (field) {
      case 'contactEmail':
        return this.contactEmailInput;
      case 'phone':
        return this.phoneInput;
      case 'websiteUrl':
        return this.websiteUrlInput;
      default:
        return this.nameInput;
    }
  }

  // Native HTML5 constraint-validation state for a field.
  fieldValidity(field: 'name' | 'contactEmail' | 'phone' | 'websiteUrl') {
    return this.fieldLocator(field).evaluate((el) => {
      const input = el as HTMLInputElement;
      return {
        valid: input.validity.valid,
        valueMissing: input.validity.valueMissing,
        typeMismatch: input.validity.typeMismatch,
        tooShort: input.validity.tooShort,
      };
    });
  }

  get logoInput() {
    return this.page.locator('input[type=file]');
  }

  get browseFilesButton() {
    return this.page.getByRole('button', { name: 'Browse files' });
  }

  // Shown when a non-image file is selected for the logo.
  get logoTypeError() {
    return this.page.getByText(/This file type is not allowed/i);
  }

  async uploadLogo(file: { name: string; mimeType: string; buffer: Buffer }) {
    await this.logoInput.setInputFiles(file);
  }
}
