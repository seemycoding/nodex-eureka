import { NodeEurekaClientService } from '../core/NodeEurekaClientService';
import { NodeEurekaConfigService } from '../core/NodeEurekaConfigService';

interface NodeEurekaClientOptions {
  appName: string;
  port: number;
  eurekaServerUrl: string;
  healthCheckPath: string;
}

const appName = NodeEurekaConfigService.get('APP_NAME');
const port = NodeEurekaConfigService.getNumber('PORT');
const eurekaServerUrl = NodeEurekaConfigService.get('EUREKA_SERVER_URL');
const healthCheckPath = NodeEurekaConfigService.get('HEALTH_CHECK_PATH', '/health');

export function NodeEurekaClient(options: NodeEurekaClientOptions) {
  return function (constructor: Function) {
    const appName = options?.appName || NodeEurekaConfigService.get('APP_NAME');
    const port = options?.port || NodeEurekaConfigService.getNumber('PORT');
    const eurekaServerUrl = options?.eurekaServerUrl || NodeEurekaConfigService.get('EUREKA_SERVER_URL');
    const healthCheckPath = options?.healthCheckPath || NodeEurekaConfigService.get('HEALTH_CHECK_PATH', '/health');

    const client = new NodeEurekaClientService({
      appName,port,eurekaServerUrl,healthCheckPath
    });
    client.register();  
  };
}
