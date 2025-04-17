// import { Request, Response, NextFunction } from 'express';
// import { GlobalRateLimit,RateLimitPolicy } from '../interfaces/ServiceInstances';
// import Redis from 'ioredis';

// const redis = new Redis();

// export function createRateLimiter(
//   appName: string,
//   globalLimit?: GlobalRateLimit,
//   serviceLimits?: RateLimitPolicy[]
// ) {
//   return async function (req: Request, res: Response, next: NextFunction) {
//     const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
//     const now = Date.now();
//     const service = extractServiceFromPath(req.path);
//     const serviceLimit = serviceLimits?.find(limit => limit.service === service);

//     const multi = redis.multi();

//     const keys: {
//       globalKey?: string;
//       serviceKey?: string;
//     } = {};

//     // GLOBAL
//     if (globalLimit) {
//       const key = `rl:global:${appName}:${ip}`;
//       keys.globalKey = key;
//       const cutoff = now - globalLimit.windowMs;
//       multi
//         .zremrangebyscore(key, 0, cutoff)
//         .zadd(key, now, `${now}`)
//         .zcard(key)
//         .expire(key, Math.ceil(globalLimit.windowMs / 1000));
//     }

//     // SERVICE
//     if (serviceLimit) {
//       const key = `rl:${appName}:${service}:${ip}`;
//       keys.serviceKey = key;
//       const cutoff = now - serviceLimit.windowMs;
//       multi
//         .zremrangebyscore(key, 0, cutoff)
//         .zadd(key, now, `${now}`)
//         .zcard(key)
//         .expire(key, Math.ceil(serviceLimit.windowMs / 1000));
//     }

//     const result = await multi.exec();

//     let globalCount = 0;
//     let serviceCount = 0;

//     let offset = 0;

//     if (globalLimit&&result) {
//       globalCount = result[offset + 2][1] as number; // FIXED
//       if (globalCount > globalLimit.max) {
//         return res.status(429).json({ error: 'Too many requests globally.' });
//       }
//       offset += 4;
//     }
    
//     if (serviceLimit&&result) {
//       serviceCount = result[offset + 2][1] as number; // FIXED
//       if (serviceCount > serviceLimit.max) {
//         return res.status(429).json({ error: `Too many requests to ${service}` });
//       }
//     }
    

//     return next();
//   };
// }

// function extractServiceFromPath(path: string): string {
//   const match = path.match(/^\/([^/]+)(\/|$)/);
//   return match ? `${match[1]}-service` : 'unknown-service';
// }

// middleware/rate-limiter.ts
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { RateLimitPolicy, GlobalRateLimit } from '../interfaces/ServiceInstances';

const redis = new Redis();

export function createRateLimiter(
  appName: string,
  globalLimit?: GlobalRateLimit,
  serviceLimits?: RateLimitPolicy[]
) {
  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    runRateLimitLogic(req, res, next, appName, globalLimit, serviceLimits).catch(err => {
      console.error('Rate limit error:', err);
      res.status(500).json({ error: 'Internal rate limit error' });
    });
  };
}

async function runRateLimitLogic(
  req: Request,
  res: Response,
  next: NextFunction,
  appName: string,
  globalLimit?: GlobalRateLimit,
  serviceLimits?: RateLimitPolicy[]
) {
  const ip = req.ip || 'unknown';
  const path = req.path;
  const service = extractServiceFromPath(path);
  const excludedPaths = [/^\/health$/, /^\/auth\/.*$/];
  const isExcluded = excludedPaths.some(pattern => pattern.test(req.path));
  
  if (isExcluded) {
    return next();
  }
  // Global limit
  if (globalLimit) {
    const key = `rl:global:${appName}:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, globalLimit.windowMs / 1000);
    console.log(count,globalLimit);
    
    if (count > globalLimit.max) {
      return res.status(429).json({ error: 'Global rate limit exceeded.' });
    }
  }

  // Per-service limit
  const serviceLimit = serviceLimits?.find(l => l.service === service);
  if (serviceLimit) {
    const key = `rl:${appName}:${service}:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, serviceLimit.windowMs / 1000);
    if (count > serviceLimit.max) {
      return res.status(429).json({ error: `Rate limit exceeded for service: ${service}` });
    }
  }

  next();
}

function extractServiceFromPath(path: string): string {  
  const parts = path.split('/');
  return parts[1] ? `${parts[1]}` : '';
}
