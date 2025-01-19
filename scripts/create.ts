import { isDev } from '@webhook-listener-api/core/utils';
import { MainDbMigrator } from '@webhook-listener-api/core/utils/db-migrator';

const command = process.argv[2] ?? null;

export const handler = async (event: any) => {
  // Also update `"typegen": "sst types",` in package.json to generate types using `kysely-codegen`

  if (!isDev()) {
    // Only run auto-migration outside of dev environments
    await MainDbMigrator.migrateToLatest();
  }
};
