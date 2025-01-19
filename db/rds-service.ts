import { RDSData, StatementTimeoutException } from '@aws-sdk/client-rds-data';
import { createId } from '@paralleldrive/cuid2';
import { Kysely, Selectable } from 'kysely';
import { DataApiDialect } from 'kysely-data-api';

import type { Database } from '@webhook-listener-api/core/types/generated-sql';
import { Config } from 'sst/node/config';
export type Row = {
  [Key in keyof Database]: Selectable<Database[Key]>;
};

/**
 * Service for interacting with AWS RDS db cluster
 */
export class RDSService {
  private static instance: RDSService | null = null; // Singleton instance
  public db: Kysely<Database>;
  private static client: RDSData;

  protected constructor(db: Kysely<Database>) {
    this.db = db;
  }

  // See: https://github.com/sst/sst/blob/master/examples/create-sst-rds/packages/core/src/sql.ts
  public static getInstance(): RDSService {
    if (!RDSService.instance) {
      const client = new RDSData({});
      const db = new Kysely<Database>({
        dialect: new DataApiDialect({
          mode: 'postgres',
          driver: {
            database: Config.MainDbClusterDefaultDbName, //RDS.AppointmentsDb.defaultDatabaseName,
            secretArn: Config.MainDbClusterSecretArn, //RDS.AppointmentsDb.secretArn,
            resourceArn: Config.MainDbClusterArn, //RDS.AppointmentsDb.clusterArn,
            client: client, // Note: Adding maxAttempts: 2 did not solve timeout issues
          },
        }),
      });
      RDSService.instance = new RDSService(db);
      RDSService.client = client;
    }

    return RDSService.instance;
  }

  public static getClient(): RDSData {
    if (!RDSService.client) {
      RDSService.getInstance();
    }
    return RDSService.client;
  }

  /**
   * Generate a unique id
   * @returns a cuid2 ID
   */
  public generateId = () => {
    return createId();
  };

  /**
   * Retries if the query fails due to a timeout or a unique violation error (i.e. on the ID field)
   * @param fn
   * @param maxAttempts
   * @param retryDelay
   * @returns
   */
  public async withTimeoutRetry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    retryDelay = 2000
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        return await fn();
      } catch (error: StatementTimeoutException | Error | any) {
        if (
          error.name === 'StatementTimeoutException' ||
          error.code === '23505'
        ) {
          attempt++;
          if (attempt >= maxAttempts) {
            throw new Error(
              `Failed after ${maxAttempts} attempts: ${error.message}`
            );
          }
          await new Promise((resolve) => setTimeout(resolve, retryDelay)); // Wait before retrying
        } else {
          throw error; // Rethrow if it's not a timeout or unique violation error
        }
      }
    }
    throw new Error('Failed after multiple attempts.');
  }
}

export abstract class RDSTable {
  abstract RdsService: RDSService;
}
