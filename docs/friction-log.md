# Friction Log: Alexa TaskFlow Build

This friction log captures real technical obstacles encountered during the setup, build, and testing of the Alexa TaskFlow MCP server.

---

## Logged Issues

### Issue 1: Pre-tool Hook Module Resolution Failure on Windows

- **Task Attempted**: Initial tool execution within the agent environment.
- **Steps**: Running any tool while the `googlecloudtools.datacloud_telemetry` plugin was registered.
- **Expected vs. Actual**:
  - *Expected*: Pre-tool hook to execute silently or allow tool dispatch.
  - *Actual*: Node.js on Windows threw `MODULE_NOT_FOUND` because the hook command passed a path with literal double-quotes (`"C:\Users\...\"`). Because the path started with `"`, `path.isAbsolute()` returned `false`, causing Node to concatenate `process.cwd()` to the path.
- **Severity**: Blocker (halted all tool execution until resolved).
- **Workaround**: Removed/moved the problematic plugin out of `~/.gemini/config/plugins/`.
- **Suggestion**: Plugin runners on Windows should strip surrounding quotes from absolute file path arguments before passing them to `node`.

---

### Issue 2: PowerShell Execution Policy Blocking `npm.ps1`

- **Task Attempted**: Running `npm` and `npx` commands in Windows PowerShell.
- **Steps**: Executing `npm -v` or `npm install`.
- **Expected vs. Actual**:
  - *Expected*: npm commands to execute.
  - *Actual*: Threw `PSSecurityException: File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.`
- **Severity**: Medium.
- **Workaround**: Executed commands via `npm.cmd` and `npx.cmd`, and documented `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.
- **Suggestion**: Mention both PowerShell execution policy bypass and `npm.cmd` explicitly in all Windows developer documentation.

---

### Issue 3: MCP Streamable HTTP 406 Not Acceptable Without Explicit Accept Header

- **Task Attempted**: Sending HTTP `POST /mcp` JSON-RPC requests from client fetch.
- **Steps**: Sent `POST /mcp` with `Content-Type: application/json` without an `Accept` header.
- **Expected vs. Actual**:
  - *Expected*: Server to respond with JSON-RPC payload or SSE.
  - *Actual*: `@modelcontextprotocol/sdk` returned `HTTP 406 Not Acceptable`.
- **Severity**: Low.
- **Workaround**: Added `Accept: application/json, text/event-stream` to all client request headers.
- **Suggestion**: The MCP SDK should default to `application/json` if the client omits the `Accept` header.

---

## Author Verification Friction Placeholders

> **Note for Author (Bhadresh):** If you hit any issues during your manual testing or video recording, record them here:

- **Task Attempted**: `[e.g., Registering endpoint in Alexa+ Developer Console]`
  - **Steps**: `[e.g., Pasted ngrok URL into Alexa+ skill endpoint field]`
  - **Expected vs. Actual**: `[e.g., Expected instant verification, actual: ...]`
  - **Severity**: `[Low / Medium / High]`
  - **Workaround**: `[e.g., Ensured ngrok tunnel had skip-browser-warning enabled]`
  - **Suggestion**: `[...]`
