import { describe, expect, it } from 'bun:test';
import { resolveActionButtonContent } from './volunteering-action-buttons';

// Regression coverage for the bug fixed alongside this test: commit 1db71fed
// put a per-volunteer named phrase (e.g. "Check in Jo Fischer") straight into
// the *visible* label of a text action button, so the button literally read
// "Check in Jo Fischer" on screen (and "Jo Fischer einchecken" in German).
// `resolveActionButtonContent` is the pure decision behind
// `VolunteeringActionButtons`: when an accessible label is supplied, the
// visible text must stay the plain label and the full phrase must only be
// exposed via the hidden (sr-only) text.
describe('resolveActionButtonContent', () => {
  it('keeps the visible text as the plain label when an accessible label is set', () => {
    const content = resolveActionButtonContent(
      'Check in',
      'Jo Fischer einchecken',
    );

    expect(content.kind).toBe('accessible');
    if (content.kind !== 'accessible') throw new Error('unreachable');
    expect(content.visibleText).toBe('Check in');
    expect(content.visibleText).not.toContain('Jo Fischer');
    expect(content.accessibleText).toBe('Jo Fischer einchecken');
    expect(content.accessibleText).toContain('Jo Fischer');
  });

  it('preserves German word order in the accessible phrase (name first, verb last)', () => {
    const content = resolveActionButtonContent(
      'Einchecken',
      'Jo Fischer einchecken',
    );

    expect(content.kind).toBe('accessible');
    if (content.kind !== 'accessible') throw new Error('unreachable');
    // "Einchecken Jo Fischer" would be the wrong (English-order) phrasing;
    // the resolved accessible text must be passed through unchanged.
    expect(content.accessibleText).toBe('Jo Fischer einchecken');
  });

  it('renders the plain label with no extra spans when there is no accessible label', () => {
    const content = resolveActionButtonContent('View', undefined);

    expect(content).toEqual({ kind: 'plain', text: 'View' });
  });
});
