#!/usr/bin/env node

/**
 * Smoke test script for Alexa TaskFlow MCP Server over Streamable HTTP.
 * Executes: initialize -> tools/list -> create_task -> list_tasks -> run_workflow(morning_setup)
 * Prints PASS/FAIL per step.
 */

const port = process.env.PORT || 3000;
const baseUrl = `http://localhost:${port}/mcp`;
const apiToken = process.env.API_TOKEN;

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

if (apiToken) {
  headers['Authorization'] = `Bearer ${apiToken}`;
}

function parseMcpPayload(text, contentType) {
  if (contentType && contentType.includes('application/json')) {
    return JSON.parse(text);
  }
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data:')) {
      const dataStr = line.slice(5).trim();
      if (dataStr) {
        return JSON.parse(dataStr);
      }
    }
  }
  throw new Error(`Failed to parse SSE data from response:\n${text}`);
}

async function postRpc(payload) {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${errorBody}`);
  }

  const text = await res.text();
  return parseMcpPayload(text, res.headers.get('content-type'));
}

async function runSmokeTest() {
  console.log(`Connecting to Alexa TaskFlow MCP endpoint at ${baseUrl}...\n`);
  let passedSteps = 0;

  // Step 1: initialize
  try {
    const initRes = await postRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'smoke-test-runner', version: '1.0.0' },
      },
    });

    if (initRes.result?.serverInfo?.name === 'alexa-taskflow') {
      console.log('PASS [1/5] initialize - Server: alexa-taskflow v1.0.0, Protocol: 2025-11-25');
      passedSteps++;
    } else {
      console.error('FAIL [1/5] initialize - Unexpected serverInfo:', initRes);
    }
  } catch (err) {
    console.error('FAIL [1/5] initialize:', err.message);
  }

  // Step 2: tools/list
  try {
    const listRes = await postRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    const tools = listRes.result?.tools || [];
    if (tools.length === 5) {
      console.log(`PASS [2/5] tools/list - Found all 5 registered tools: ${tools.map((t) => t.name).join(', ')}`);
      passedSteps++;
    } else {
      console.error(`FAIL [2/5] tools/list - Expected 5 tools, found ${tools.length}`);
    }
  } catch (err) {
    console.error('FAIL [2/5] tools/list:', err.message);
  }

  // Step 3: create_task
  try {
    const createRes = await postRpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'create_task',
        arguments: { title: 'Smoke test automated check' },
      },
    });

    const outputText = createRes.result?.content?.[0]?.text || '';
    if (outputText.includes('Smoke test automated check')) {
      console.log(`PASS [3/5] create_task - ${outputText}`);
      passedSteps++;
    } else {
      console.error('FAIL [3/5] create_task - Output:', createRes);
    }
  } catch (err) {
    console.error('FAIL [3/5] create_task:', err.message);
  }

  // Step 4: list_tasks
  try {
    const listTasksRes = await postRpc({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'list_tasks',
        arguments: { status: 'open' },
      },
    });

    const outputText = listTasksRes.result?.content?.[0]?.text || '';
    if (outputText.includes('Smoke test automated check')) {
      console.log(`PASS [4/5] list_tasks - ${outputText}`);
      passedSteps++;
    } else {
      console.error('FAIL [4/5] list_tasks - Output:', listTasksRes);
    }
  } catch (err) {
    console.error('FAIL [4/5] list_tasks:', err.message);
  }

  // Step 5: run_workflow (morning_setup)
  try {
    const workflowRes = await postRpc({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'run_workflow',
        arguments: { name: 'morning_setup' },
      },
    });

    const outputText = workflowRes.result?.content?.[0]?.text || '';
    if (outputText.includes('Morning setup complete')) {
      console.log(`PASS [5/5] run_workflow(morning_setup) - ${outputText}`);
      passedSteps++;
    } else {
      console.error('FAIL [5/5] run_workflow(morning_setup) - Output:', workflowRes);
    }
  } catch (err) {
    console.error('FAIL [5/5] run_workflow(morning_setup):', err.message);
  }

  console.log(`\nSmoke Test Summary: ${passedSteps}/5 steps passed.`);
  if (passedSteps === 5) {
    console.log('STATUS: ALL CHECKS PASSED');
    process.exitCode = 0;
  } else {
    console.log('STATUS: FAILED');
    process.exitCode = 1;
  }
}

runSmokeTest();
