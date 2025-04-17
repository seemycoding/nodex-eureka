import axios from 'axios';
import { ServiceInstance } from '../interfaces/ServiceInstances';
import { ServiceLogs } from './ServiceLogs';
interface NodeEurekaClientOptions {
  appName: string;
  port: number;
  eurekaServerUrl: string;
  healthCheckPath: string;
}

export class NodeEurekaClientService {
  private options: NodeEurekaClientOptions;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(options: NodeEurekaClientOptions) {
    this.options = options;

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async register() {
    try {
      console.log(`${this.options.eurekaServerUrl}/register`);
      
      await axios.post(`${this.options.eurekaServerUrl}/register`, {
        appName: this.options.appName,
        port: this.options.port,
        healthCheckPath: this.options.healthCheckPath, 
        status:"UP",
        ip:'localhost'
      });
      ServiceLogs.info(this.options.appName, `Registered instance at port ${this.options.port}`);
      this.startHeartbeat();
    } catch (error:any) {
      ServiceLogs.error(this.options.appName, `Failed to register with Eureka: ${error.message}`);
    }
  }

   startHeartbeat() {
    const heartbeatInterval =  5000; // default 30s
  
    setInterval(async () => {
      try {
        // Step 1: Check health before sending heartbeat (if healthCheckPath is set)
        if (this.options.healthCheckPath) {
          const healthUrl = `http://localhost:${this.options.port}${this.options.healthCheckPath}`;                    
          const healthResponse = await axios.get(healthUrl);
          
  
          if (
            healthResponse.status !== 200 ||
            healthResponse.data.status?.toUpperCase?.() !== 'UP'
          ) {
            ServiceLogs.warn(this.options.appName, `Health check failed. Skipping heartbeat.`);
            return;
          }
        }
  
        // Step 2: Send heartbeat if healthy
        await axios.post(`${this.options.eurekaServerUrl}/heartbeat`, {
          appName: this.options.appName,
          port: this.options.port,
        });
        ServiceLogs.info(this.options.appName, `Sent heartbeat successfully`);
      } catch (err:any) {
        ServiceLogs.error(this.options.appName, `Heartbeat error: ${err.message}`);

      }
    }, heartbeatInterval);
  }
  

  async shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    try {
      await axios.post(`${this.options.eurekaServerUrl}/deregister`, {
        appName: this.options.appName,
        port: this.options.port,
      });
      ServiceLogs.warn(`${this.options.appName}`,`deregistered from Eureka`)
    } catch (error:any) {
      ServiceLogs.error(`Failed to deregister:`, error.message)
    } finally {
      process.exit(0);
    }
  }

  async discover(appName: string) {
    try {
      const res = await axios.get(`${this.options.eurekaServerUrl}/services/${appName}`);
      ServiceLogs.info(`Discoverd`,appName)
      return res.data;
    } catch (error:any) {
      ServiceLogs.error(`Discovery failed:`, error.message)
      return [];
    }
  }

  async getInstances(appName: string): Promise<ServiceInstance[]> {
    try {
      const res = await fetch(`${this.options.eurekaServerUrl}/eureka/registry/${appName}`);
      const data = await res.json();
      return data.instances || [];
    } catch (error:any) {
      ServiceLogs.error(`Failed to get instances for ${appName}`, error.message)
      return [];
    }
  }
}
