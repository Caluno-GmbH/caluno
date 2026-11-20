import { registerEnumType } from '@nestjs/graphql';

/**
 * The areas a change-feed entry can report on.
 *
 * Keys are uppercase and values lowercase on purpose: `registerEnumType`
 * derives GraphQL enum *names* from the keys (so the schema reads `CONTRACTS`,
 * `INVOICES`, `MEMBERSHIP_REQUESTS`), while the database stores the lowercase
 * values.
 */
export enum ChangeArea {
  CONTRACTS = 'contracts',
  INVOICES = 'invoices',
  MEMBERSHIP_REQUESTS = 'membership-requests',
}

registerEnumType(ChangeArea, {
  name: 'ChangeArea',
});
