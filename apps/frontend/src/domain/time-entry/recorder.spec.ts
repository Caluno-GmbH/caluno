import { describe, expect, it } from 'bun:test';
import { describeRecorder } from './recorder';

describe('describeRecorder', () => {
  it('returns unknown when there is no recorder', () => {
    expect(describeRecorder({ createdBy: null })).toEqual({
      name: null,
      onBehalf: false,
    });
  });

  it('does not mark a self-recorded entry as on behalf', () => {
    expect(
      describeRecorder({
        volunteer: { id: 'user-1' },
        createdBy: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
      }),
    ).toEqual({ name: 'Alice', onBehalf: false });
  });

  it('marks an entry recorded by someone else as on behalf', () => {
    expect(
      describeRecorder({
        volunteer: { id: 'user-1' },
        createdBy: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
      }),
    ).toEqual({ name: 'Admin', onBehalf: true });
  });

  it('falls back to the email when the recorder has no name', () => {
    expect(
      describeRecorder({
        volunteer: { id: 'user-1' },
        createdBy: { id: 'admin-1', name: '', email: 'admin@example.com' },
      }).name,
    ).toBe('admin@example.com');
  });
});
