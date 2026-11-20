import { graphqlBatch, view } from '../lib/client.ts';
import { pickRandom, type SetupData } from '../lib/data.ts';
import { think } from '../lib/time.ts';

/** An anonymous visitor opening an organization's public page. */
export function visitorJourney(data: SetupData) {
  const unit = pickRandom(data.units);
  const session = {};

  view(session, `/orgs/${unit.id}`, () =>
    graphqlBatch(session, [
      { name: 'GetPublicOrganizationUnit', variables: { id: unit.id } },
      {
        name: 'GetPublicShiftsByOrganizationUnit',
        variables: { organizationUnitId: unit.id },
      },
      {
        name: 'GetPublicEventsByOrganizationUnit',
        variables: { organizationUnitId: unit.id },
      },
    ]),
  );
  think();
}
