import { ServiceInstance } from "../interfaces/ServiceInstances";
type LoadBalancingStrategy = 'ROUND_ROBIN' | 'RANDOM';

export class NodeEurekaLoadBalancer {
  private static roundRobinIndex: Record<string, number> = {};

  static getInstance(
    appName: string,
    instances: ServiceInstance[],
    strategy: LoadBalancingStrategy = 'ROUND_ROBIN'
  ): ServiceInstance | null {
    if (instances.length === 0) return null;

    if (strategy === 'RANDOM') {
      const index = Math.floor(Math.random() * instances.length);
      return instances[index];
    }

    if (strategy === 'ROUND_ROBIN') {
      if (!this.roundRobinIndex[appName]) this.roundRobinIndex[appName] = 0;

      const index = this.roundRobinIndex[appName] % instances.length;
      this.roundRobinIndex[appName] = (this.roundRobinIndex[appName] + 1) % instances.length;

      return instances[index];
    }

    return instances[0]; // fallback
  }
}



