import { ServiceInstance } from "../interfaces/ServiceInstances";

export class NodeEurekaRegistry {
  private static instance: NodeEurekaRegistry;

    private services: Record<string, ServiceInstance[]> = {};


    public static getInstance(): NodeEurekaRegistry {
      if (!NodeEurekaRegistry.instance) {
        NodeEurekaRegistry.instance = new NodeEurekaRegistry();        
      }
      return NodeEurekaRegistry.instance;
    }

    private generateInstanceId(host:string,appName: string, port: number): string {
        return `${host}:${appName}:${port}-${Math.random().toString(36).substring(2, 8)}-${Date.now()}`;
      }

    register(instance: ServiceInstance) {
      
      const existing = this.services[instance.appName] || [];
      const index = existing.findIndex(s => s.port === instance.port);
      const timestamp = Date.now();
      if (index !== -1) {
        existing[index].lastHeartbeat = timestamp;
      } else {
        existing.push({ ...instance, instanceId: this.generateInstanceId(instance.ip,instance.appName,instance.port), lastHeartbeat: timestamp });
      }
      this.services[instance.appName] = existing;
      
    }
  
    heartbeat(appName: string, port: number) {              
      const instances = this.services[appName];
      if (!instances) return false;
      const instance = instances.find(s => s.port === port);            
      if (instance) {
        instance.lastHeartbeat = Date.now();
        return true;
      }
      return false;
    }
  
    deregister(appName: string, port: number) {      
      const instances = this.services[appName];
      
      if (!instances) return;
  
      this.services[appName] = instances.filter(inst => inst.port !== port);

    }
  
    getServices() {
      // Optionally filter out dead services (older than 30s)      
      const now = Date.now();
      const result: typeof this.services = {};
      for (const appName in this.services) {        
        const activeInstances = this.services[appName].filter(
          s => now - s.lastHeartbeat < 30000
        );
        if (activeInstances.length > 0) {
          result[appName] = activeInstances;
        }
      }
      return result;
    }
  
    getService(appName: string) {
      const now = Date.now();
      const instances = this.services[appName] || [];
      return instances.filter(inst => now - inst.lastHeartbeat < 30000);
    }
  }
  