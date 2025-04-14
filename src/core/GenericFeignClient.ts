import { NodeEurekaClientService } from "./NodeEurekaClientService";
import { NodeEurekaLoadBalancer } from "./NodeEurekaLoadBalancer";

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
    }) {
      const client = new NodeEurekaClientService({
        appName: callerAppName,
        port: callerPort,
        eurekaServerUrl,
        healthCheckPath: '/health'
      });
  
      const instances = await client.discover(serviceName);
      if (!instances.length) throw new Error(`${serviceName} not found`);
      
      const instanceMeta = NodeEurekaLoadBalancer.getInstance(serviceName, instances, 'ROUND_ROBIN');
      if (!instanceMeta) throw new Error(`No available instances for ${serviceName}`);
  
      const url = `http://${instanceMeta.ip}:${instanceMeta.port}${path}`;
         
      const fetchOpts: any = {
        method,
        headers: headers || { 'Content-Type': 'application/json' },
      };
  
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOpts.body = JSON.stringify(body);
      }
  
      const response = await fetch(url, fetchOpts);      
      return response;
    }
  }
  