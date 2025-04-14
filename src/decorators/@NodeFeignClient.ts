import 'reflect-metadata';
import { NodeEurekaClientService } from '../core/NodeEurekaClientService';
import { NodeEurekaLoadBalancer } from '../core/NodeEurekaLoadBalancer';
import { METHOD_META_KEY } from './HttpMethods';
import { ServiceLogs } from '../core/ServiceLogs';
import { NodeEurekaConfigService } from '../core/NodeEurekaConfigService';

interface NodeFeignClientOptions {
  serviceName: string;
  callerPort?: number;
  retry?: number;
  failover?: boolean;
  retryDelay?:number;
}
const defaultretryCount = NodeEurekaConfigService.getNumber('RETRY_ATTEMPTS', 3);
const deafultretryDelay = NodeEurekaConfigService.getNumber('RETRY_DELAY', 500);
const defaultfailover = NodeEurekaConfigService.getBoolean('FAILOVER',false);
const defaultcallerPort = NodeEurekaConfigService.getNumber('CALLER_PORT');
const defaultserviceName = NodeEurekaConfigService.get('APP_NAME');

const FEIGN_CLIENT_KEY = Symbol('FEIGN_CLIENT');

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export function NodeFeignClient(options: NodeFeignClientOptions): ClassDecorator {
  return function (target: any) {
    const retry = options?.retry||defaultretryCount
    const retryDelay = options.retryDelay||deafultretryDelay;
    const failover = options?.failover||defaultfailover;
    const callerPort = options?.callerPort||defaultcallerPort;
    const serviceName = options?.serviceName||defaultserviceName;
    Reflect.defineMetadata(FEIGN_CLIENT_KEY, {retry,retryDelay,failover,callerPort,serviceName}, target);

    return new Proxy(target, {
      construct(_, args) {
        const instance = new target(...args);
        const methodNames = Object.getOwnPropertyNames(target.prototype).filter(
          (key) => typeof instance[key] === 'function' && key !== 'constructor'
        );

        for (const methodName of methodNames) {
          const methodMeta = Reflect.getMetadata(METHOD_META_KEY, target.prototype, methodName);

          if (methodMeta) {
            instance[methodName] = async function (...params: any[]) {
              const client = new NodeEurekaClientService({
                appName: serviceName || 'UnknownClient',
                port: callerPort || 0,
                eurekaServerUrl: methodMeta.eurekaServerUrl,
                healthCheckPath: '/health'
              });

              const instances = await client.discover(serviceName);

              if (!instances.length) {
                ServiceLogs.warn(serviceName, `${serviceName} not found`);
                throw new Error(`${serviceName} not found`);
              }

              const maxRetries = retry ?? 1;
              const Isfailover = failover ?? true;

              for (let i = 0; i < instances.length; i++) {
                const instanceMeta = NodeEurekaLoadBalancer.getInstance(serviceName, instances, 'ROUND_ROBIN');
                if (!instanceMeta) continue;

                const url = `http://${instanceMeta.ip}:${instanceMeta.port}${methodMeta.path}`;
                const method = methodMeta.method;

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

                    return await response.json();
                  } catch (err) {
                    ServiceLogs.warn(serviceName, `Attempt ${attempt} failed on ${instanceMeta.ip}:${instanceMeta.port}: ${err}`);
                    await wait(100 * attempt);
                  }
                }

                if (!Isfailover) break; // Stop if failover is disabled
              }

              throw new Error(`All retries and failovers failed for ${serviceName}`);
            };
          }
        }

        return instance;
      }
    });
  };
}
