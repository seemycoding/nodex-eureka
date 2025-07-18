import 'reflect-metadata';
import { NodeEurekaClientService } from '../core/NodeEurekaClientService';
import { NodeEurekaLoadBalancer } from '../core/NodeEurekaLoadBalancer';
import { METHOD_META_KEY } from './HttpMethods';
import { ServiceLogs } from '../core/ServiceLogs';
import { NodeEurekaConfigService } from '../core/NodeEurekaConfigService';

interface NodeFeignClientOptions {
  serviceName: string;
  callerPort?: number;
  retryConfig?:{
  retry: number;
  failover: boolean;
  retryDelay: number;
  },
  rcacheConfig?:{
    ttl: number, // Cache TTL in milliseconds
    enabled: boolean
  }

}

const defaultretryCount = NodeEurekaConfigService.getNumber('RETRY_ATTEMPTS', 3);
const deafultretryDelay = NodeEurekaConfigService.getNumber('RETRY_DELAY', 500);
const defaultfailover = NodeEurekaConfigService.getBoolean('FAILOVER', false);
const defaultcallerPort = NodeEurekaConfigService.getNumber('CALLER_PORT');
const defaultserviceName = NodeEurekaConfigService.get('SERVICE_NAME');
const defaultcacheTTL = NodeEurekaConfigService.getNumber('DISCOVERY_CACHE_TTL', 10_000); // 10s

const serviceCache: Record<string, any[]> = {};
const lastCacheUpdate: Record<string, number> = {};

const FEIGN_CLIENT_KEY = Symbol('FEIGN_CLIENT');
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export function NodexFeignClient(options?: NodeFeignClientOptions): ClassDecorator {
  return function (target: any) {
    const retry = options?.retryConfig?.retry ?? defaultretryCount;
    const retryDelay = options?.retryConfig?.retryDelay ?? deafultretryDelay;
    const failover = options?.retryConfig?.failover ?? defaultfailover;
    const callerPort = options?.callerPort ?? defaultcallerPort;
    const serviceName = options?.serviceName ?? defaultserviceName;
    const cacheTTL=options?.rcacheConfig?.ttl ?? defaultcacheTTL

    Reflect.defineMetadata(FEIGN_CLIENT_KEY, { retry, retryDelay, failover, callerPort, serviceName }, target);

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

              // Caching logic
              let instances = serviceCache[serviceName];
              const now = Date.now();
              const isStale = !instances || (now - (lastCacheUpdate[serviceName] || 0) > cacheTTL);

              if (isStale) {
                try {
                  instances = await client.discover(serviceName);
                  serviceCache[serviceName] = instances;
                  lastCacheUpdate[serviceName] = Date.now();
                } catch (err) {
                  ServiceLogs.warn(serviceName, `Discovery failed: ${err}`);
                  throw new Error(`${serviceName} discovery failed`);
                }
              }

              if (!instances || !instances.length) {
                ServiceLogs.warn(serviceName, `${serviceName} not found`);
                throw new Error(`${serviceName} not found`);
              }

              const maxRetries = retry;
              const Isfailover = failover;
              const delay = retryDelay;

              for (let i = 0; i < instances.length; i++) {
                const instanceMeta = NodeEurekaLoadBalancer.getInstance(serviceName, instances, 'ROUND_ROBIN');
                if (!instanceMeta) continue;

                const url = `http://${instanceMeta.ip}:${instanceMeta.port}${methodMeta.path}`;
                const method = methodMeta.method;

                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                  console.log(`trying ${attempt} on node feign at ${url}`);

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
                    console.log(`Failed ${attempt} on node feign at ${url}`);
                    await wait(delay * attempt);
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
