import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const customEnvPath = path.resolve(process.cwd(), '.node-eureka.env');

if (fs.existsSync(customEnvPath)) {
  dotenv.config({ path: customEnvPath });
} else {
  console.warn(`[NodeEureka] Warning: .node-eureka.env file not found in ${process.cwd()}`);
}

export class NodeEurekaConfigService {
  static get(key: string, fallback?: string): string {
    return process.env[key] || fallback || '';
  }

  static getNumber(key: string, fallback?: number): number {
    const value = process.env[key];
    return value ? parseInt(value, 10) : fallback || 0;
  }

  static getBoolean(key: string, fallback = false): boolean {
    const val = process.env[key];
    if (val === undefined) return fallback;
    return val.toLowerCase() === 'true';
  }
  static getJSON<T = any>(key: string, defaultValue: T): T {    
    console.log(process.env);
    
    const rawValue = process.env[key];
    console.log(rawValue,"rawValue");
    
    if (!rawValue) return defaultValue;
  
    try {
      return JSON.parse(rawValue) as T;
    } catch (err) {
      console.warn(`[NodeEurekaConfigService] Failed to parse JSON for key "${key}":`, err);
      return defaultValue;
    }
  }
}
