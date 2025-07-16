import { RequestHandler } from 'express';

export interface ServiceInstance {
    instanceId:string;
    appName: string;
    port: number;
    healthCheckPath: string;
    lastHeartbeat: number;
    status:string;
    ip:string
  }

  // types.ts
export interface GatewayRoute {
  id: string;
  uri: string; // eg: "lb://userservice"
  predicates: string[]; // eg: "Path=/userservice/**"
  filters: string[]; // eg: "StripPrefix=1"
}



export interface Gateway{
 
    appName: string;
    port: number;
    eurekaServerUrl: string;
    routes: GatewayRoute[];
    rateLimit?:{
    limits: RateLimitPolicy[];
    globalRateLimit: GlobalRateLimit;
    }
    authFilters?:RequestHandler;
    useBuiltInAuth?: boolean;
    builtInAuthSecret?:string;
    retryConfig?:{
    retry:number;
    retryDelay:number;
    failover:boolean;
    }

  
}

export interface RateLimitOptions {
  service: string;
  path: string;
  windowMs: number;
  max: number;
}


export interface RateLimitPolicy {
  service: string;
  windowMs: number;
  max: number;
}

export interface GlobalRateLimit {
  windowMs: number;
  max: number;
}