import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function createAuthMiddleware(apiToken?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // If no API_TOKEN is configured, auth is bypassed
    if (!apiToken) {
      return next();
    }

    // Public endpoints bypass auth
    if (req.path === '/healthz' || req.path === '/demo' || req.path.startsWith('/demo/')) {
      return next();
    }

    // Allow CORS preflight OPTIONS requests without auth
    if (req.method === 'OPTIONS') {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Unauthorized: Missing or invalid Bearer token',
        },
        id: null,
      });
      return;
    }

    const token = authHeader.slice(7).trim();
    const tokenBuffer = Buffer.from(token, 'utf-8');
    const expectedBuffer = Buffer.from(apiToken, 'utf-8');

    if (
      tokenBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
    ) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Unauthorized: Invalid Bearer token',
        },
        id: null,
      });
      return;
    }

    return next();
  };
}
