import express, { type Request, type Response, type Express } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { config, type Config } from './config.js';
import { createServer, TOOL_NAMES } from './createServer.js';
import { InMemoryTaskStore, type TaskStore } from './services/taskStore.js';
import { DynamoTaskStore } from './services/taskStoreDynamo.js';
import { GitHubService } from './services/github.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { createRateLimitMiddleware } from './middleware/rateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppOptions {
  config?: Config;
  taskStore?: TaskStore;
  githubService?: GitHubService;
}

export function createApp(options: AppOptions = {}): Express {
  const cfg = options.config || config;

  let taskStore = options.taskStore;
  if (!taskStore) {
    if (cfg.TASK_STORE === 'dynamodb') {
      taskStore = new DynamoTaskStore({
        tableName: cfg.DYNAMODB_TABLE_NAME,
        region: cfg.AWS_REGION,
      });
    } else {
      taskStore = new InMemoryTaskStore(cfg.TASKS_FILE);
    }
  }

  const githubService = options.githubService || new GitHubService(cfg.GITHUB_TOKEN);

  const app = express();

  // Normalize /api prefix if routed through Vercel serverless function
  app.use((req: Request, _res: Response, next) => {
    if (req.url.startsWith('/api/') || req.url === '/api') {
      req.url = req.url.replace(/^\/api/, '') || '/';
    }
    next();
  });

  // 100kb body limit
  app.use(express.json({ limit: '100kb' }));

  // CORS Middleware
  app.use(createCorsMiddleware(cfg.CORS_ORIGIN));

  // Rate Limiting (60 req/min per IP by default)
  app.use(createRateLimitMiddleware(cfg.RATE_LIMIT_PER_MIN));

  // Authentication Middleware (protects POST /mcp if API_TOKEN is set)
  app.use(createAuthMiddleware(cfg.API_TOKEN));

  // GET / - Root redirects to /demo
  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/demo');
  });

  // GET /healthz - Public health and capability check
  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      name: 'alexa-taskflow',
      version: '1.0.0',
      protocolVersion: LATEST_PROTOCOL_VERSION || '2025-11-25',
      tools: TOOL_NAMES,
    });
  });

  // GET /demo - Static HTML demo page
  app.get(['/demo', '/demo/index.html'], (_req: Request, res: Response) => {
    // Check multiple candidate locations for demo/index.html
    const candidatePaths = [
      path.join(__dirname, 'demo', 'index.html'),
      path.join(__dirname, '..', 'src', 'demo', 'index.html'),
      path.join(__dirname, '..', 'dist', 'demo', 'index.html'),
      path.join(process.cwd(), 'src', 'demo', 'index.html'),
      path.join(process.cwd(), 'dist', 'demo', 'index.html'),
      path.join(__dirname, '..', 'demo', 'index.html'),
    ];

    const foundPath = candidatePaths.find((p) => fs.existsSync(p));
    if (foundPath) {
      const html = fs.readFileSync(foundPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } else {
      res.status(404).send('Demo UI not found');
    }
  });

  // Reject non-POST/OPTIONS methods on /mcp with 405 Method Not Allowed and JSON-RPC error
  app.all('/mcp', (req: Request, res: Response, next) => {
    if (req.method !== 'POST' && req.method !== 'OPTIONS') {
      res.setHeader('Allow', 'POST, OPTIONS');
      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message:
            'Method not allowed. Streamable HTTP MCP server operates statelessly over POST /mcp.',
        },
        id: null,
      });
      return;
    }
    next();
  });

  // POST /mcp - Streamable HTTP stateless MCP endpoint
  app.post('/mcp', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const toolName = req.body?.method === 'tools/call' ? req.body?.params?.name : undefined;
    const rpcMethod = req.body?.method || 'unknown';

    // Stateless mode: sessionIdGenerator: undefined per MCP spec 2025-11-25
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const mcpServer = createServer({
      taskStore: taskStore!,
      githubService,
    });

    let cleanedUp = false;
    const cleanup = async () => {
      if (cleanedUp) return;
      cleanedUp = true;
      try {
        await transport.close();
        await mcpServer.close();
      } catch {
        // Ignore close errors
      }
    };

    res.on('close', cleanup);
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      if (toolName) {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            type: 'tool_call',
            tool: toolName,
            durationMs,
            status: res.statusCode,
          })
        );
      } else {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            type: 'mcp_request',
            method: rpcMethod,
            durationMs,
            status: res.statusCode,
          })
        );
      }
    });

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err: unknown) {
      await cleanup();
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: `Internal server error: ${(err as Error).message}`,
          },
          id: req.body?.id ?? null,
        });
      }
    }
  });

  return app;
}

export function startServer(port = config.PORT, host = '0.0.0.0') {
  const app = createApp();
  const server = app.listen(port, host, () => {
    console.log(`Alexa TaskFlow MCP server on http://${host}:${port}/mcp`);
  });

  const shutdown = () => {
    console.log('\nShutting down Alexa TaskFlow MCP server gracefully...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

// Export default Express app for serverless runtimes (Vercel, AWS Lambda, etc.)
const defaultApp = createApp();
export default defaultApp;

// Start if executed directly and not running in Vercel serverless environment
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain && !process.env.VERCEL) {
  startServer();
}
