/**
 * Stack housing the primary API Gateway, and startup/shutdown scripts
 */
import {
  Api,
  Config,
  FunctionProps,
  Script,
  StackContext,
  use,
} from 'sst/constructs';
import { getApiRoutes } from '../packages/core/src/utils';
import { getIsDev } from './utils';
import { DatabaseStack } from './DatabaseStack';

export function ApiStack({ stack, app }: StackContext) {
  // Import stack outputs
  const { MainDbClusterParams, MainDbCluster } = use(DatabaseStack);

  const GOOGLE_SA_EMAIL = new Config.Secret(stack, 'GOOGLE_SA_EMAIL');
  const GOOGLE_PRIVATE_KEY = new Config.Secret(stack, 'GOOGLE_PRIVATE_KEY');
  const googleSecrets = [GOOGLE_SA_EMAIL, GOOGLE_PRIVATE_KEY];
  const RETOOL_API_KEY = new Config.Secret(stack, 'RETOOL_API_KEY');

  const stage = app.stage;
  const isDev = getIsDev(app);
  const apiRoutes = getApiRoutes(isDev);
  const getLogRetention = (isDev: boolean): FunctionProps['logRetention'] => {
    return isDev ? 'one_day' : 'two_months';
  };

  const zone = 'bluestonehealth.co';
  const baseDomain = `webhooks-${stage}.${zone}`;
  // Create the HTTP API
  const api = new Api(stack, 'Api', {
    customDomain: {
      domainName: baseDomain,
      hostedZone: zone,
    },
    routes: apiRoutes,
    defaults: {
      function: {
        // NOTE: sns permission should only be required here in dev...
        permissions: ['ses:SendEmail', 'dynamodb', 'sns'],
        timeout: 120,
        logRetention: getLogRetention(isDev),
        memorySize: '1 GB',
        bind: [
          ...googleSecrets,
          RETOOL_API_KEY,

          // appointmentTable,
          ...MainDbClusterParams,
        ],
      },
    },
  });
  for (const [k, _] of Object.entries(apiRoutes)) {
    const f = api.getFunction(k);
    if (f) {
      MainDbCluster.grantDataApiAccess(f);
    }
  }

  // https://docs.sst.dev/constructs/Script
  const script = new Script(stack, 'Script', {
    onCreate: 'packages/functions/scripts/create.handler',
    onUpdate: 'packages/functions/scripts/update.handler',
    onDelete: 'packages/functions/scripts/delete.handler',
    params: {
      stage: stage,
    },
    defaults: {
      function: {
        logRetention: getLogRetention(isDev),
        permissions: ['ses:SendEmail', 'dynamodb'],
        bind: [...MainDbClusterParams],
        timeout: 20,
      },
    },
  });
  for (const f of [
    script.updateFunction,
    script.deleteFunction,
    script.createFunction,
  ]) {
    if (f) {
      MainDbCluster.grantDataApiAccess(f);
    }
  }

  script.node.addDependency(api); // Will run after the API is deployed
  const API_BASE_URL = new Config.Parameter(stack, 'API_BASE_URL', {
    value: api.customDomainUrl ?? baseDomain,
  });
  api.bind([API_BASE_URL]);

  // Show the API endpoint in the output
  stack.addOutputs({
    ApiEndpoint: api.url,
    CustomDomainURL: api.customDomainUrl,
  });
}
