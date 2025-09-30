import type { Request, Response, NextFunction } from "express";

export interface RateLimiterConfig {
  requestsPerMinute: number;
  burstSize: number;
  cleanupIntervalMs: number;
}

export const defaultRateLimiterConfig: RateLimiterConfig = {
  requestsPerMinute: 60,
  burstSize: 10,
  cleanupIntervalMs: 5 * 60 * 1000,
};

export const strictRateLimiterConfig: RateLimiterConfig = {
  requestsPerMinute: 30,
  burstSize: 5,
  cleanupIntervalMs: 5 * 60 * 1000,
};

function getClientIP(req: Request): string {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
    req.headers["x-real-ip"]?.toString() ||
    req.socket.remoteAddress ||
    ""
  );
}

export function rateLimiterMiddleware(config: RateLimiterConfig) {
  const clients = new Map<string, { tokens: number; lastRefill: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [ip, client] of clients.entries()) {
      if (now - client.lastRefill > 10 * 60 * 1000) {
        clients.delete(ip);
      }
    }
  }, config.cleanupIntervalMs);

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIP(req);
    const now = Date.now();
    let client = clients.get(ip);

    if (!client) {
      client = { tokens: config.burstSize, lastRefill: now };
      clients.set(ip, client);
    }

    // Refill tokens
    const timePassed = now - client.lastRefill;
    const tokensToAdd = Math.floor((timePassed / 60000) * config.requestsPerMinute);
    if (tokensToAdd > 0) {
      client.tokens = Math.min(client.tokens + tokensToAdd, config.burstSize);
      client.lastRefill = now;
    }

    if (client.tokens > 0) {
      client.tokens--;
      next();
    } else {
      res.setHeader("X-RateLimit-Limit", config.requestsPerMinute.toString());
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("Retry-After", "60");
      res.status(429).json({
        title: "Rate Limit Exceeded",
        message: "Too many requests. Please try again later.",
        status: "error",
        data: null,
      });
    }
  };
}

export function globalRateLimiter() {
  return rateLimiterMiddleware(defaultRateLimiterConfig);
}

export function strictRateLimiter() {
  return rateLimiterMiddleware(strictRateLimiterConfig);
}
