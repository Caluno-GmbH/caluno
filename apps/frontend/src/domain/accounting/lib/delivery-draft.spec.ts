import { describe, expect, it } from 'bun:test';
import {
  AccountingSettingSourceKind,
  BundleDeliveryMethod,
  type RawAccountingDeliverySettings,
} from '@repo/data';
import {
  buildDeliveryUpdate,
  createDeliveryDraft,
  draftValues,
  insertSubjectPlaceholder,
  isDeliveryDraftDirty,
  isEmailMethod,
  ownAfterEdit,
  ownAfterRecipientEdit,
  recipientError,
  sourceForDisplay,
  subjectError,
} from './delivery-draft';

const baseSettings: RawAccountingDeliverySettings = {
  deliveryMethod: BundleDeliveryMethod.Download,
  recipientEmail: 'root@example.org',
  emailSubject: 'Abrechnung {volunteer}',
  ownDeliveryMethod: null,
  ownRecipientEmail: null,
  ownEmailSubject: null,
  inheritedDeliveryMethod: BundleDeliveryMethod.Download,
  inheritedRecipientEmail: 'root@example.org',
  inheritedEmailSubject: 'Abrechnung {volunteer}',
  defaultEmailSubject: 'Abrechnung {volunteer}',
  deliveryMethodSource: {
    kind: AccountingSettingSourceKind.Inherited,
    sourceName: 'Root',
  },
  recipientEmailSource: {
    kind: AccountingSettingSourceKind.Inherited,
    sourceName: 'Root',
  },
  emailSubjectSource: {
    kind: AccountingSettingSourceKind.Inherited,
    sourceName: 'Root',
  },
};

function settings(
  patch: Partial<RawAccountingDeliverySettings> = {},
): RawAccountingDeliverySettings {
  return { ...baseSettings, ...patch };
}

describe('createDeliveryDraft', () => {
  it('starts inherited fields at their effective value', () => {
    expect(createDeliveryDraft(settings())).toEqual({
      method: { value: BundleDeliveryMethod.Download, own: false },
      recipient: { value: 'root@example.org', own: false },
      subject: { value: 'Abrechnung {volunteer}', own: false },
    });
  });

  it('turns the values back into form values', () => {
    expect(draftValues(createDeliveryDraft(settings()))).toEqual({
      method: BundleDeliveryMethod.Download,
      recipient: 'root@example.org',
      subject: 'Abrechnung {volunteer}',
    });
  });
});

describe('ownAfterEdit', () => {
  it('leaves an inherited field inherited until the value differs', () => {
    expect(ownAfterEdit(false, 'Download', 'Download')).toBe(false);
    expect(ownAfterEdit(false, 'Email', 'Download')).toBe(true);
  });

  it('keeps an own field own even when it is set back to the inherited value', () => {
    expect(ownAfterEdit(true, 'Download', 'Download')).toBe(true);
  });

  it('compares recipient addresses without incidental whitespace', () => {
    expect(
      ownAfterRecipientEdit(false, ' root@example.org ', 'root@example.org'),
    ).toBe(false);
    expect(
      ownAfterRecipientEdit(false, 'child@example.org', 'root@example.org'),
    ).toBe(true);
  });
});

describe('isDeliveryDraftDirty', () => {
  it('is false for an untouched draft', () => {
    const initial = createDeliveryDraft(settings());
    expect(isDeliveryDraftDirty(initial, { ...initial })).toBe(false);
  });

  it('is true once a value becomes an override', () => {
    const initial = createDeliveryDraft(settings());
    const draft = createDeliveryDraft(settings());
    draft.recipient = { value: 'child@example.org', own: true };
    expect(isDeliveryDraftDirty(initial, draft)).toBe(true);
  });

  it('ignores paused email fields under Download', () => {
    const initial = createDeliveryDraft(settings());
    const draft = createDeliveryDraft(settings());
    draft.recipient = { value: 'child@example.org', own: true };
    expect(isDeliveryDraftDirty(initial, draft, false)).toBe(false);
  });
});

describe('buildDeliveryUpdate', () => {
  it('sends nothing for untouched fields', () => {
    const initial = createDeliveryDraft(settings());
    expect(buildDeliveryUpdate(initial, { ...initial })).toEqual({});
  });

  it('resets an own field with null', () => {
    const initial = createDeliveryDraft(
      settings({
        recipientEmail: 'child@example.org',
        ownRecipientEmail: 'child@example.org',
        recipientEmailSource: {
          kind: AccountingSettingSourceKind.Own,
          sourceName: null,
        },
      }),
    );
    const draft = createDeliveryDraft(settings());
    expect(buildDeliveryUpdate(initial, draft)).toEqual({
      recipientEmail: null,
    });
  });

  it('sends an intentional empty value as an override', () => {
    const initial = createDeliveryDraft(settings());
    const draft = createDeliveryDraft(settings());
    draft.recipient = { value: '', own: true };
    draft.subject = { value: '', own: true };
    expect(buildDeliveryUpdate(initial, draft)).toEqual({
      recipientEmail: '',
      emailSubject: '',
    });
  });

  it('omits paused email fields while Download is selected', () => {
    const initial = createDeliveryDraft(settings());
    const draft = createDeliveryDraft(settings());
    draft.recipient = { value: 'child@example.org', own: true };
    draft.subject = { value: '', own: true };
    expect(buildDeliveryUpdate(initial, draft, false)).toEqual({});
  });

  it('sends the selected method only when it changed', () => {
    const initial = createDeliveryDraft(settings());
    const draft = createDeliveryDraft(settings());
    draft.method = { value: BundleDeliveryMethod.Email, own: true };
    expect(buildDeliveryUpdate(initial, draft)).toEqual({
      deliveryMethod: BundleDeliveryMethod.Email,
    });
  });
});

describe('isEmailMethod', () => {
  it('distinguishes the two delivery methods', () => {
    expect(isEmailMethod(BundleDeliveryMethod.Email)).toBe(true);
    expect(isEmailMethod(BundleDeliveryMethod.Download)).toBe(false);
  });
});

describe('recipientError', () => {
  it('does not require or validate an address while bundles are downloaded', () => {
    expect(recipientError('', BundleDeliveryMethod.Download)).toBeNull();
    expect(recipientError('nope', BundleDeliveryMethod.Download)).toBeNull();
  });

  it('requires an address when bundles are emailed', () => {
    expect(recipientError('  ', BundleDeliveryMethod.Email)).toBe(
      'recipientRequired',
    );
  });

  it('rejects an invalid address', () => {
    expect(recipientError('nope', BundleDeliveryMethod.Email)).toBe(
      'invalidEmail',
    );
  });

  it('accepts a valid address', () => {
    expect(
      recipientError(' accounting@example.org ', BundleDeliveryMethod.Email),
    ).toBeNull();
  });
});

describe('subjectError', () => {
  it('rejects an unknown placeholder', () => {
    expect(subjectError('{volunteer} {iban}')).toBe('unknownPlaceholder');
  });

  it('rejects a subject over the limit', () => {
    expect(subjectError('x'.repeat(201))).toBe('tooLong');
  });

  it('accepts a subject exactly at the limit', () => {
    expect(subjectError('x'.repeat(200))).toBeNull();
  });
});

describe('insertSubjectPlaceholder', () => {
  it('inserts at the caret and moves it after the token', () => {
    expect(insertSubjectPlaceholder('Hello ', '{volunteer}', 6, 6)).toEqual({
      value: 'Hello {volunteer}',
      caret: 17,
    });
  });

  it('replaces the current selection', () => {
    expect(insertSubjectPlaceholder('Hello world', '{period}', 6, 11)).toEqual({
      value: 'Hello {period}',
      caret: 14,
    });
  });

  it('appends when there is no caret', () => {
    expect(insertSubjectPlaceholder('Hello', '{type}', null, null)).toEqual({
      value: 'Hello{type}',
      caret: 11,
    });
  });
});

describe('sourceForDisplay', () => {
  it('shows inherited until the value becomes an override', () => {
    const source = {
      kind: AccountingSettingSourceKind.Inherited,
      sourceName: 'Root',
    } as const;
    expect(sourceForDisplay(source, true)).toEqual({
      kind: AccountingSettingSourceKind.Own,
      sourceName: null,
    });
    expect(sourceForDisplay(source, false)).toEqual(source);
  });

  it('drops the saved source name when an own value is reset', () => {
    expect(
      sourceForDisplay(
        { kind: AccountingSettingSourceKind.Own, sourceName: null },
        false,
      ),
    ).toEqual({
      kind: AccountingSettingSourceKind.Inherited,
      sourceName: null,
    });
  });
});
