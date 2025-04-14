// core/gateway-manager.ts
import express, { Request, Response } from 'express';
import { GatewayRoute,Gateway, GlobalRateLimit, RateLimitPolicy } from '../interfaces/ServiceInstances';
import { NodeEurekaRegistry } from '../core/NodeEurekaRegistry';
import { GenericFeignClient } from '../core/GenericFeignClient';
import { NodeEurekaClientService } from '../core/NodeEurekaClientService';
import { createRateLimiter } from '../middlewares/RateLimiter';
import { ServiceLogs } from '../core/ServiceLogs';
import { NodeEurekaConfigService } from '../core/NodeEurekaConfigService';

const defaultPort = NodeEurekaConfigService.getNumber('PORT', 500);
const defaultEurekaServerUrl = NodeEurekaConfigService.get('EUREKA_SERVER_URL');
const defaultRoutes = NodeEurekaConfigService.getJSON('ROUTES',[]);
const defaultRateLimits= NodeEurekaConfigService.getJSON('RATE_LIMITS',{service:'',max:0,windowMs:0,path:''});
const defaultGlobalRateLimits= NodeEurekaConfigService.getJSON('GLOBAL_RATE_LIMITS',{windowMs:0,max:0});



export function NodeEurekaGateway(options:Gateway) {
 return function(constructor: Function){
  const appName = options?.appName || NodeEurekaConfigService.get('APP_NAME');
    const port = options?.port || defaultPort;
    const eurekaServerUrl = options?.eurekaServerUrl || defaultEurekaServerUrl;
    const routes = options?.routes || defaultRoutes;
    const rateLimits:any = options?.rateLimits || defaultRateLimits;
    const globalRateLimit = options?.globalRateLimit || defaultGlobalRateLimits;
  const app = express();
  app.use(express.json());

  app.use(createRateLimiter(appName,globalRateLimit,rateLimits));
  // const asyncMiddleware = (fn: any) => (req: Request, res: Response, next: NextFunction) => {
  //   Promise.resolve(fn(req, res, next)).catch(next);
  // }; 
  // app.use(asyncMiddleware(createRateLimiter));

  for (const route of routes) {
    const pathPredicate = route.predicates.find(p => p.startsWith('Path='));
    const stripPrefix = route.filters.find(f => f.startsWith('StripPrefix=')) || 'StripPrefix=0';
    const prefixCount = parseInt(stripPrefix.split('=')[1], 10);
    const originalPath = pathPredicate?.split('=')[1] || '';    
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch'] as const;

    for (const method of httpMethods) {
      (app[method] as any)(originalPath.replace('**', '*'), async (req: Request, res: Response) => {
        try {
          const serviceName = route.uri.replace('lb://', '');
          const serviceInstance = NodeEurekaRegistry.getInstance().getService(serviceName);

          if (!serviceInstance) {
            ServiceLogs.error(appName,`No instance found for ${serviceName}`)
            return res.status(503).send({ error: `No instance found for ${serviceName}` });
          }

          // Strip the prefix
          const splitPath = req.path.split('/');
          const strippedPath = '/' + splitPath.slice(prefixCount + 1).join('/');
          const response = await GenericFeignClient.call({
            method: req.method as any,
            path: strippedPath,
            body: req.body,
            params: req.query,
            headers: req.headers,
            serviceName:serviceName,
            callerAppName:appName,
            callerPort:port,
            eurekaServerUrl:eurekaServerUrl
          });          
          res.status(response.status).json(await response.json());
        } catch (error: any) {
          res.status(500).send({
            error: `Failed to route to ${route.id}`,
            message: error.message,
          });
        }
      });
    }
  }

  // Health check
  app.get('/health',(req,res)=>{
    res.send({status:"UP"})
  });

  app.listen(port, () => {
    ServiceLogs.info(appName,`API Gateway running on port ${port}`)
    console.log();
  });

  // Register gateway as a service
  const client = new NodeEurekaClientService({
    appName: appName,
    port: port,
    eurekaServerUrl: eurekaServerUrl,
    healthCheckPath: '/health'
  });
  client.register();

  
 }
}
