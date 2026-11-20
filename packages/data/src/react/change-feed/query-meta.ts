import type { ChangeArea } from '../../generated/base-types';

export { ChangeArea } from '../../generated/base-types';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      changeAreas?: ChangeArea[];
    };
  }
}
