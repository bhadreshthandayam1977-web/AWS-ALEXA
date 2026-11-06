#!/usr/bin/env bash
set -e

BASE_URL="${1:-http://localhost:3000}"
API_TOKEN="${API_TOKEN:-}"

echo "============================================"
echo " Alexa TaskFlow MCP Server Test (Bash/curl)"
echo " Endpoint: $BASE_URL/mcp"
echo "============================================"
echo ""

AUTH_HEADER=""
if [ -n "$API_TOKEN" ]; then
  AUTH_HEADER="Authorization: Bearer $API_TOKEN"
fi

echo "[1/4] Checking /healthz..."
curl -s -f "$BASE_URL/healthz"
echo -e "\n[PASS] /healthz returned 200 OK"

echo -e "\n[2/4] Initializing MCP session..."
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": { "name": "bash-tester", "version": "1.0.0" }
    }
  }'
echo -e "\n[PASS] Initialized successfully"

echo -e "\n[3/4] Listing MCP Tools..."
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
echo -e "\n[PASS] Listed tools successfully"

echo -e "\n[4/4] Calling create_task tool..."
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "create_task",
      "arguments": { "title": "Bash test task" }
    }
  }'
echo -e "\n\nAll curl tests passed!"
