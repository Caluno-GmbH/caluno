import { applyTestDatabaseEnvironment } from './ensure-test-database';

/**
 * Import this before AppModule: ConfigModule.forRoot() captures DB_NAME when
 * AppModule is evaluated, and the test database is created later.
 */
applyTestDatabaseEnvironment();
