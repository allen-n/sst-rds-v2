/**
 * Automatic type generation based on SST V2 repo:
 * https://github.com/sst/v2/blob/dfcfc3f3460c0d46bf0165716271817975e417f8/packages/sst/src/cli/commands/plugins/kysely.ts#L11
 */
import { Kysely } from 'kysely';
import { DataApiDialect } from 'kysely-data-api';
import { RDSData } from '@aws-sdk/client-rds-data';
import * as fs from 'fs/promises';
import {
  ExportStatementNode,
  PostgresDialect,
  MysqlDialect,
  Serializer,
  Transformer,
} from 'kysely-codegen';
import { logger } from '../logger';
import { RDSService } from '../rds/rds-service';
import { Config } from 'sst/node/config';

interface Database {
  defaultDatabaseName: string;
  engine: string;
  secretArn: string;
  clusterArn: string;
  client: RDSData;
  types?: {
    path: string;
    camelCase?: boolean;
  };
}

export const useKyselyTypeGenerator = async (databases: Database[]) => {
  async function generate(db: Database) {
    if (!db.types) return;

    const dataApi = new DataApiDialect({
      mode: db.engine.includes('postgres') ? 'postgres' : 'mysql',
      driver: {
        secretArn: db.secretArn,
        resourceArn: db.clusterArn,
        database: db.defaultDatabaseName,
        client: db.client,
      },
    });

    const k = new Kysely<any>({
      dialect: dataApi,
    });

    const dialect = db.engine.includes('postgres')
      ? new PostgresDialect()
      : new MysqlDialect();
    const instrospection = await dialect.introspector.introspect({
      // @ts-ignore
      db: k,
    });
    logger.info('introspected tables');

    const transformer = new Transformer();
    const nodes = transformer.transform({
      dialect: dialect,
      camelCase: (db.types.camelCase as any) === true,
      metadata: instrospection,
    });
    logger.info('transformed nodes', nodes.length);
    const lastIndex = nodes.length - 1;
    const last = nodes[lastIndex] as ExportStatementNode;
    nodes[lastIndex] = {
      ...last,
      argument: {
        ...last.argument,
        name: 'Database',
      },
    };
    const serializer = new Serializer();
    const data = serializer.serialize(nodes);
    await fs.writeFile(db.types.path, data);
  }
  databases.map((db) =>
    generate(db).catch((err) => {
      logger.error(err);
    })
  );

  logger.info('Loaded kyseley type generator');
};

export async function run() {
  const client = RDSService.getClient();
  const db = {
    defaultDatabaseName: 'main_db',
    engine: 'postgres',
    secretArn: Config.MainDbClusterSecretArn,
    clusterArn: Config.MainDbClusterArn,
    client: client,
    types: {
      path: 'packages/core/src/types/generated-sql.ts',
    },
  } satisfies Database;
  await useKyselyTypeGenerator([db]);
}

const command = process.argv[2];
if (command && command === 'generate') {
  await run();
}
