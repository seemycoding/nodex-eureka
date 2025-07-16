import express from 'express';
import path from 'path';
import { NodeEurekaRegistry } from '../core/NodeEurekaRegistry';
import { ServiceLogs } from '../core/ServiceLogs';
import { NodeEurekaConfigService } from '../core/NodeEurekaConfigService';
interface NodeEurekaServerOptions {
  port: number;
}
const defaultPort = NodeEurekaConfigService.getNumber('PORT', 500);


export function NodeEurekaServer(options?: NodeEurekaServerOptions) {
  return function (constructor: Function) {
    const port = options?.port || defaultPort;

    const app = express();
    app.use(express.json());
    const registry = NodeEurekaRegistry.getInstance();
   

    app.post('/register', (req, res) => {
        const registeredServices:any= Object.values(registry.getServices()).flat(); // Flatten the array of service lists
        const registryList:any=Object.keys(registeredServices).map((registeredServiceKey)=>registeredServices[registeredServiceKey])
        const service = req.body;        
        if (registryList!==undefined&&registryList.length) {
            const existing = registryList.find((s: { appName: any; port: any; }) => s.appName === service.appName && s.port === service.port);
            if (existing) {
              existing.lastHeartbeat = Date.now();
              existing.status = 'UP'; 
        }else{
            registry.register(req.body)

        }
        } else {
          registry.register(req.body)
        }
        res.send({ message: 'Registered' });
      });

    app.get('/services', (req, res) => {
      res.send(registry.getServices());
    });

    app.post('/heartbeat', (req, res) => {
        const { appName, port } = req.body;
        const success = registry.heartbeat(appName, port);
        res.status(success ? 200 : 404).send();
      });
      
      app.post('/deregister', (req, res) => {
        const { appName, port } = req.body;
        registry.deregister(appName, port);
        res.status(200).send({ status: 'Deregistered' });
      });
      
      app.get('/services/:appName', (req, res) => {
        const { appName } = req.params;
        res.send(registry.getService(appName));
      });

      app.get('/__eureka__/services/logs', (req, res) => {        
        res.json(ServiceLogs.getAllLogs());
      });

      app.get('/__eureka__/services', (req, res) => {
        const registeredServices=registry.getServices()  
        res.json(registeredServices);
      });

      app.get('/enviroment',(req,res)=>{
         res.send({
          env:process.env.NODE_ENV||"Development",
          data_center_count:1
         });
      })

   
      
      
        const dashboardPath = path.join(__dirname, '../dashboard'); // or '../dashboard' if outside dist

        app.use(express.static(dashboardPath));

        // Step 2: Catch-all for React Router (send index.html for unmatched routes)
        app.get('*', (req, res) => {
        res.sendFile(path.join(dashboardPath, 'index.html'));
        });

    app.listen(port, () => {
      ServiceLogs.info("Eureka",`Eureka Server running on port ${port}`)
      console.log(`Eureka Server running on port ${port}`);
    });
  };
}
