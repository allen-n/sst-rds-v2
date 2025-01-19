import fs from 'fs/promises';
import path from 'path';

import { FileMigrationProvider, Migrator } from 'kysely';

import { logger } from '@webhook-listener-api/core/logger';
import { RDSService } from '@webhook-listener-api/core/rds/rds-service';

const dbService = RDSService.getInstance();
export const MainDbMigrator = new Migrator({
  db: dbService.db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.resolve('./migrations'),
  }),
});

const command = process.argv[2];
const validCommands = ['list', 'up', 'down', 'latest', '-h', '--help', 'help'];
async function run() {
  if (!command) {
    logger.error(
      'no command provided, valid commands are:\nlist, up, down, latest, [target_migration_name]'
    );
    return;
  }

  function getHelpMessage(): string {
    return `
  Available commands:
    list   - List all migrations
    up     - Migrate up
    down   - Migrate down
    latest - Migrate to the latest version
    [target_migration_name] - Migrate to a specific migration
    -h, --help, help - Display this help message
    `;
  }

  if (command === '-h' || command === '--help' || command === 'help') {
    logger.log(getHelpMessage());
  }

  if (command === 'list') {
    logger.log('listing migrations');
    const list = await MainDbMigrator.getMigrations();
    logger.log(list);
    return list;
  }

  if (command === 'up') {
    logger.log('migrating up');
    return await MainDbMigrator.migrateUp();
  }

  if (command === 'down') {
    logger.log('migrating down');
    return await MainDbMigrator.migrateDown();
  }

  if (command === 'latest') {
    logger.log('migrating to latest');
    return await MainDbMigrator.migrateToLatest();
  }

  logger.log('migrating to', command);
  return await MainDbMigrator.migrateTo(command);
}
if (command && validCommands.includes(command)) {
  const results = await run();
  if (results) logger.log(results);
}
