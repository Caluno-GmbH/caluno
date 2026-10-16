import type { CodegenConfig } from '@graphql-codegen/cli';

const scalars = {
  ID: 'string',
  DateTime: 'string',
  JSON: 'Record<string, unknown>',
};

const config: CodegenConfig = {
  schema: '../../apps/backend/src/schema.gql',
  documents: ['src/**/*.graphql'],
  generates: {
    'src/generated/base-types.ts': {
      plugins: ['typescript'],
      config: {
        skipTypename: false,
        scalars,
      },
    },
    'src/generated/graphql.ts': {
      plugins: ['typescript-operations', 'typescript-graphql-request'],
      config: {
        importSchemaTypesFrom: 'src/generated/base-types.ts',
        skipTypename: false,
        enumType: 'native',
        scalars,
        rawRequest: false,
        gqlImport: 'graphql-request#gql',
        dedupeFragments: true,
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
