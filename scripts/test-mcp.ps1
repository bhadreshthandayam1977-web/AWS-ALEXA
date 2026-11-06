# PowerShell test script for Alexa TaskFlow MCP Server

param (
    [string]$BaseUrl = "http://localhost:3000",
    [string]$ApiToken = ""
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Alexa TaskFlow MCP Server Test (PowerShell)" -ForegroundColor Cyan
Write-Host " Endpoint: $BaseUrl/mcp" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
    "Accept" = "application/json, text/event-stream"
}

if ($ApiToken -ne "") {
    $headers["Authorization"] = "Bearer $ApiToken"
}

function Test-McpStep {
    param (
        [string]$StepName,
        [hashtable]$Payload
    )

    $jsonBody = $Payload | ConvertTo-Json -Depth 5
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/mcp" -Method Post -Headers $headers -Body $jsonBody
        Write-Host "[PASS] $StepName" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "[FAIL] $StepName - $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# 1. Health check
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/healthz" -Method Get
    Write-Host "[PASS] Healthz Check: status=$($health.status), tools count=$($health.tools.Count)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Healthz Check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. initialize
$initPayload = @{
    jsonrpc = "2.0"
    id = 1
    method = "initialize"
    params = @{
        protocolVersion = "2025-11-25"
        capabilities = @{}
        clientInfo = @{ name = "ps-tester"; version = "1.0.0" }
    }
}
$initRes = Test-McpStep -StepName "Initialize Handshake" -Payload $initPayload

# 3. tools/list
$listPayload = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/list"
    params = @{}
}
$listRes = Test-McpStep -StepName "List Tools" -Payload $listPayload

# 4. create_task
$createPayload = @{
    jsonrpc = "2.0"
    id = 3
    method = "tools/call"
    params = @{
        name = "create_task"
        arguments = @{ title = "PowerShell verified task" }
    }
}
$createRes = Test-McpStep -StepName "Create Task" -Payload $createPayload

# 5. list_tasks
$listTasksPayload = @{
    jsonrpc = "2.0"
    id = 4
    method = "tools/call"
    params = @{
        name = "list_tasks"
        arguments = @{ status = "open" }
    }
}
$listTasksRes = Test-McpStep -StepName "List Tasks Call" -Payload $listTasksPayload

Write-Host "`nTest run completed." -ForegroundColor Cyan
