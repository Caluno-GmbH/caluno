import { fixtureOrgUnitId } from './fixture-helpers';

describe('fixtureOrgUnitId', () => {
  it('is stable for the same slug', () => {
    expect(fixtureOrgUnitId('demo-altonaer-lesepaten-west')).toBe(
      fixtureOrgUnitId('demo-altonaer-lesepaten-west'),
    );
  });

  it('gives every demo unit its own id', () => {
    const ids = [
      'demo-altonaer-lesepaten',
      'demo-altonaer-lesepaten-nord',
      'demo-altonaer-lesepaten-sued',
      'demo-altonaer-lesepaten-west',
    ].map(fixtureOrgUnitId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns a v4 uuid', () => {
    expect(fixtureOrgUnitId('demo-altonaer-lesepaten-west')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
