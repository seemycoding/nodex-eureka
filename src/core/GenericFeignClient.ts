import { NodeEurekaClientService } from "./NodeEurekaClientService";
import { NodeEurekaLoadBalancer } from "./NodeEurekaLoadBalancer";
import { ServiceLogs } from "./ServiceLogs";
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export class GenericFeignClient {
  static async call({
    serviceName,
    path,
    method,
    body,
    params,
    headers,
    eurekaServerUrl,
    callerAppName = 'GenericCaller',
    callerPort = 0,
    retry, retryDelay, failover
  }: {
    serviceName: string;
    path: string;
    method: string;
    body?: any;
    params?: any;
    headers?: any;
    eurekaServerUrl: string;
    callerAppName?: string;
    callerPort?: number;
    retry: number, retryDelay: number, failover: boolean;
  }) {

    const client = new NodeEurekaClientService({
      appName: callerAppName,
      port: callerPort,
      eurekaServerUrl,
      healthCheckPath: '/health'
    });

    const instances = await client.discover(serviceName);
    if (!instances.length) throw new Error(`${serviceName} not found`);

    const maxRetries = retry ?? 1;
    const Isfailover = failover ?? false;
    const delay = retryDelay??500

    for (let i = 0; i < instances.length; i++) {
      const instanceMeta = NodeEurekaLoadBalancer.getInstance(serviceName, instances, 'ROUND_ROBIN');
      if (!instanceMeta) continue;

      const url = `http://${instanceMeta.ip}:${instanceMeta.port}${path}`;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const fetchOpts: any = {
            method,
            headers: { 'Content-Type': 'application/json' }
          };

          if (['POST', 'PUT'].includes(method)) {
            fetchOpts.body = JSON.stringify(params[0]);
          }

          const response = await fetch(url, fetchOpts);

          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }

          return response
        } catch (err) {
          ServiceLogs.warn(serviceName, `Attempt ${attempt} failed on ${instanceMeta.ip}:${instanceMeta.port}: ${err}`);
          await wait(delay * attempt);
        }
      }

      if (!Isfailover) break; // Stop if failover is disabled
    }

    throw new Error(`All retries and failovers failed for ${serviceName}`);
  }
}
