import { describe, expect, it } from 'bun:test';
import { mergeEeMessages } from './merge-ee-messages';

describe('mergeEeMessages', () => {
  it('adds a new EE-only namespace alongside the OSS namespaces', () => {
    const base = { Common: { save: 'Save' } };
    const ee = { EeNote: { title: 'My note' } };

    expect(mergeEeMessages(base, ee)).toEqual({
      Common: { save: 'Save' },
      EeNote: { title: 'My note' },
    });
  });

  it('merges EE keys into an existing OSS namespace', () => {
    const base = { Navigation: { home: 'Home' } };
    const ee = { Navigation: { myNote: 'My Note' } };

    expect(mergeEeMessages(base, ee)).toEqual({
      Navigation: { home: 'Home', myNote: 'My Note' },
    });
  });

  it('does not mutate the base catalog', () => {
    const base = { Navigation: { home: 'Home' } };
    const ee = { Navigation: { myNote: 'My Note' } };

    mergeEeMessages(base, ee);

    expect(base).toEqual({ Navigation: { home: 'Home' } });
  });
});
