/**
 * The areas a change-feed entry can report on.
 *
 * Keys are uppercase and values lowercase on purpose: the enum is registered
 * with `registerEnumType` later, which derives GraphQL enum *names* from the
 * keys (so the schema reads `CONTRACTS`, `INVOICES`, `MEMBERSHIP_REQUESTS`),
 * while the database stores the lowercase values.
 */
export enum ChangeArea {
  CONTRACTS = 'contracts',
  INVOICES = 'invoices',
  MEMBERSHIP_REQUESTS = 'membership-requests',
}
