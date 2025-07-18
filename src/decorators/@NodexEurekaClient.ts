import { NodeEurekaClientService } from '../core/NodeEurekaClientService';
import { NodeEurekaConfigService } from '../core/NodeEurekaConfigService';

interface NodeEurekaClientOptions {
  appName: string;
  port: number;
  eurekaServerUrl: string;
  healthCheckPath: string;
}

const defaultAppName = NodeEurekaConfigService.get('APP_NAME');
const defaultPort = NodeEurekaConfigService.getNumber('PORT');
const defaulteurekaServerUrl = NodeEurekaConfigService.get('EUREKA_SERVER_URL');
const defaulthealthCheckPath = NodeEurekaConfigService.get('HEALTH_CHECK_PATH', '/health');

export function NodexEurekaClient(options?: NodeEurekaClientOptions) {
  return function (constructor: Function) {
    const appName = options?.appName || defaultAppName;
    const port = options?.port || defaultPort;
    const eurekaServerUrl = options?.eurekaServerUrl || defaulteurekaServerUrl;
    const healthCheckPath = options?.healthCheckPath || defaulthealthCheckPath;
    console.log(eurekaServerUrl);
    
    
    const client = new NodeEurekaClientService({
      appName,port,eurekaServerUrl,healthCheckPath
    });
    client.register();  
  };
}
