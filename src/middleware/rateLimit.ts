import type { Request, Response, NextFunction } from 'express';

export function createRateLimitMiddleware(limitPerMin = 60) {
  const windowMs = 60 * 1000;
  const requests = new Map<string, number[]>();

  // Periodic cleanup of stale IP records
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, valid);
      }
    }
  }, windowMs);
  cleanup.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const timestamps = (requests.get(ip) || []).filter((t) => now - t < windowMs);

    if (timestamps.length >= limitPerMin) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: `Too Many Requests: Rate limit exceeded (${limitPerMin} req/min)`,
        },
        id: null,
      });
      return;
    }

    timestamps.push(now);
    requests.set(ip, timestamps);
    next();
  };
}
