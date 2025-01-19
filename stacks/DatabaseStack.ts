/**
 * Data layer stack, housing persistent SQL data storage
 */
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Config, StackContext } from 'sst/constructs';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';

import { getIsDev } from './utils';

export function DatabaseStack({ stack, app }: StackContext) {
  const isDev = getIsDev(app);

  const vpc = new ec2.Vpc(stack, 'MainDbVPC', {
    maxAzs: 2, // Adjust the number of Availability Zones as needed
  });

  const securityGroup = new ec2.SecurityGroup(stack, 'MainDbSecurityGroup', {
    vpc: vpc,
    description: 'Allow access to Aurora cluster',
    allowAllOutbound: true,
  });

  const defaultDatabaseName = 'main_db';
  const dbCluster = new rds.DatabaseCluster(stack, 'MainDbCluster', {
    engine: rds.DatabaseClusterEngine.auroraPostgres({
      // For auto pause, 13.9 in us-west-1 (N. California) is sufficient based on these docs:
      // https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html#auto-pause-prereqs
      version: rds.AuroraPostgresEngineVersion.VER_13_15,
    }),
    vpc: vpc,
    writer: rds.ClusterInstance.serverlessV2('MainDbWriter'),
    readers: [rds.ClusterInstance.serverlessV2('MainDbReader')],
    securityGroups: [securityGroup],
    serverlessV2MinCapacity: isDev ? 0 : 0.5, // Minimum ACU
    serverlessV2MaxCapacity: 6, // Maximum ACU

    defaultDatabaseName: defaultDatabaseName,
    deletionProtection: !isDev, // Enable deletion protection in prod
    removalPolicy: isDev ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN, // Retain the cluster in PR stages to complete cleanup
    backup: {
      retention: isDev ? Duration.days(1) : Duration.days(21), // Retain backups for 7 days
    },
    enableDataApi: true,
  });

  const MainDbClusterArn = new Config.Parameter(stack, 'MainDbClusterArn', {
    value: dbCluster.clusterArn,
  });
  const MainDbClusterSecretArn = new Config.Parameter(
    stack,
    'MainDbClusterSecretArn',
    {
      value: dbCluster.secret?.secretArn || '',
    }
  );
  const MainDbClusterDefaultDbName = new Config.Parameter(
    stack,
    'MainDbClusterDefaultDbName',
    {
      value: defaultDatabaseName,
    }
  );

  // Show the API endpoint in the output
  stack.addOutputs({
    MainDbClusterArn: dbCluster.clusterArn,
    MainDbClusterEndpoint: dbCluster.clusterEndpoint.hostname,
  });

  return {
    MainDbClusterParams: [
      MainDbClusterArn,
      MainDbClusterSecretArn,
      MainDbClusterDefaultDbName,
    ],
    MainDbCluster: dbCluster,
  };
}
