import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../../src/server.js';
import { InMemoryTaskStore } from '../../src/services/taskStore.js';
import { GitHubService } from '../../src/services/github.js';
import { loadConfig } from '../../src/config.js';

function parseMcpResponse(rawText: string, contentType: string | null) {
  if (contentType?.includes('application/json')) {
    return JSON.parse(rawText);
  }
  // Parse SSE data: lines
  const lines = rawText.split('\n');
  for (const line of lines) {
    if (line.startsWith('data:')) {
      const jsonStr = line.slice(5).trim();
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
    }
  }
  throw new Error(`Could not parse MCP response from:\n${rawText}`);
}

describe('Integration: MCP Streamable HTTP Server', () => {
  let server: Server;
  let baseUrl: string;
  let taskStore: InMemoryTaskStore;
  let githubService: GitHubService;

  beforeAll(async () => {
    taskStore = new InMemoryTaskStore();
    githubService = new GitHubService();
    const app = createApp({
      taskStore,
      githubService,
      config: {
        ...loadConfig({
          PORT: '0',
          RATE_LIMIT_PER_MIN: '100',
        }),
      },
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  const sendMcpPost = async (payload: any, headers: Record<string, string> = {}) => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const parsed =
      res.status < 400 ? parseMcpResponse(text, res.headers.get('content-type')) : null;
    return { res, text, parsed };
  };

  it('asserts initialize returns serverInfo.name "alexa-taskflow"', async () => {
    const initPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'vitest-client', version: '1.0.0' },
      },
    };

    const { res, parsed } = await sendMcpPost(initPayload);
    expect(res.status).toBe(200);
    expect(parsed.result).toBeDefined();
    expect(parsed.result.serverInfo.name).toBe('alexa-taskflow');
    expect(parsed.result.serverInfo.version).toBe('1.0.0');
    expect(parsed.result.protocolVersion).toBe('2025-11-25');
  });

  it('asserts tools/list returns exactly 5 tools', async () => {
    const listPayload = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    };

    const { res, parsed } = await sendMcpPost(listPayload);
    expect(res.status).toBe(200);
    expect(parsed.result).toBeDefined();
    expect(parsed.result.tools).toBeInstanceOf(Array);
    expect(parsed.result.tools.length).toBe(5);

    const names = parsed.result.tools.map((t: any) => t.name).sort();
    expect(names).toEqual([
      'complete_task',
      'create_task',
      'list_tasks',
      'run_workflow',
      'summarize_repo',
    ]);
  });

  it('create_task then list_tasks reflects the added task', async () => {
    const createPayload = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'create_task',
        arguments: { title: 'Integration Test Task' },
      },
    };

    const createResult = await sendMcpPost(createPayload);
    expect(createResult.res.status).toBe(200);
    expect(createResult.parsed.result.content[0].text).toContain(
      'Added task 1: Integration Test Task'
    );

    const listPayload = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'list_tasks',
        arguments: { status: 'open' },
      },
    };

    const listResult = await sendMcpPost(listPayload);
    expect(listResult.res.status).toBe(200);
    expect(listResult.parsed.result.content[0].text).toContain('1, Integration Test Task');
  });

  it('invalid input returns an error not a crash', async () => {
    const invalidPayload = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'create_task',
        arguments: { title: '' }, // empty title violates min(1)
      },
    };

    const { res, parsed } = await sendMcpPost(invalidPayload);
    expect(res.status).toBe(200);
    // Returns error structure without server dying
    expect(parsed.error || parsed.result?.isError).toBeTruthy();
  });

  it('returns 405 with JSON-RPC error on GET /mcp and DELETE /mcp', async () => {
    const getRes = await fetch(`${baseUrl}/mcp`, { method: 'GET' });
    expect(getRes.status).toBe(405);
    const getBody = await getRes.json();
    expect(getBody.jsonrpc).toBe('2.0');
    expect(getBody.error.code).toBe(-32601);

    const delRes = await fetch(`${baseUrl}/mcp`, { method: 'DELETE' });
    expect(delRes.status).toBe(405);
    const delBody = await delRes.json();
    expect(delBody.jsonrpc).toBe('2.0');
    expect(delBody.error.code).toBe(-32601);
  });

  it('GET /healthz and GET /demo return 200', async () => {
    const healthRes = await fetch(`${baseUrl}/healthz`);
    expect(healthRes.status).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.status).toBe('ok');
    expect(healthJson.name).toBe('alexa-taskflow');
    expect(healthJson.tools.length).toBe(5);

    const demoRes = await fetch(`${baseUrl}/demo`);
    expect(demoRes.status).toBe(200);
    const demoHtml = await demoRes.text();
    expect(demoHtml).toContain('Alexa TaskFlow');
  });
});

describe('Integration: Authentication & Rate Limiting', () => {
  it('enforces API_TOKEN authentication on POST /mcp while keeping /healthz and /demo public', async () => {
    const secret = 'super-secret-key-12345';
    const app = createApp({
      config: {
        ...loadConfig({
          PORT: '0',
          API_TOKEN: secret,
        }),
      },
    });

    let srv: Server;
    let url: string;
    await new Promise<void>((resolve) => {
      srv = app.listen(0, () => {
        const addr = srv.address() as any;
        url = `http://localhost:${addr.port}`;
        resolve();
      });
    });

    try {
      // 1. Without token -> 401
      const noTokenRes = await fetch(`${url}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      expect(noTokenRes.status).toBe(401);

      // 2. With invalid token -> 401
      const badTokenRes = await fetch(`${url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-token',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      expect(badTokenRes.status).toBe(401);

      // 3. With valid token -> 200
      const validRes = await fetch(`${url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' },
          },
        }),
      });
      expect(validRes.status).toBe(200);

      // 4. /healthz remains public
      const healthRes = await fetch(`${url}/healthz`);
      expect(healthRes.status).toBe(200);

      // 5. /demo remains public
      const demoRes = await fetch(`${url}/demo`);
      expect(demoRes.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  it('rate limiter returns 429 after threshold is reached', async () => {
    const app = createApp({
      config: {
        ...loadConfig({
          PORT: '0',
          RATE_LIMIT_PER_MIN: '3', // allow only 3 req/min
        }),
      },
    });

    let srv: Server;
    let url: string;
    await new Promise<void>((resolve) => {
      srv = app.listen(0, () => {
        const addr = srv.address() as any;
        url = `http://localhost:${addr.port}`;
        resolve();
      });
    });

    try {
      const makeReq = () => fetch(`${url}/healthz`);

      // 3 requests allowed
      const r1 = await makeReq();
      expect(r1.status).toBe(200);
      const r2 = await makeReq();
      expect(r2.status).toBe(200);
      const r3 = await makeReq();
      expect(r3.status).toBe(200);

      // 4th request must be rate limited to 429
      const r4 = await makeReq();
      expect(r4.status).toBe(429);
      expect(r4.headers.get('retry-after')).toBe('60');
      const body = await r4.json();
      expect(body.error.code).toBe(-32000);
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });
});
