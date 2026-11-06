import { defineConfig } from 'drizzle-kit';

/**
 * OSS / core migration stream.
 * EE schemas live under `src/ee/**` and use `src/ee/drizzle.config.ts`.
 */
export default defineConfig({
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST as string,
    port: parseInt(process.env.DB_PORT as string, 10),
    user: process.env.DB_USER as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_NAME as string,
    ssl: false,
  },
  migrations: {
    schema: 'public',
    table: '__drizzle_migrations',
  },
});
