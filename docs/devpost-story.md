# Devpost Project Story: Alexa TaskFlow

> **Note for Author (Bhadresh):** Replace the bracketed placeholders `[like this]` with your personal reflections or confirmations before publishing to Devpost.

---

## Inspiration

As developers, some of our most productive insights strike when we are not sitting at the keyboard—while brewing coffee, during morning walks, or while winding down for the evening. Yet capturing those insights into our task managers or checking repository status usually requires breaking our flow, unlocking a laptop, navigating browser tabs, and typing.

With the release of Alexa+ and its native support for the Model Context Protocol (MCP), a new possibility emerged: what if Alexa could serve as an intelligent, conversational bridge to our real engineering workflow? Instead of standard smart home commands, we could speak naturally: *"Alexa, add task: review the authentication PR"* or *"Alexa, start my morning setup"*, and have our tasks captured, prioritized, and synchronized instantly. That vision inspired **Alexa TaskFlow**.

---

## What It Does

Alexa TaskFlow is a self-hosted MCP server implementing the official 2025-11-25 Model Context Protocol specification over Streamable HTTP. It exposes 5 voice-optimized developer workflow tools:

1. **`create_task`**: Captures developer tasks and todos with auto-incrementing tracking and speaks back the total open task count.
2. **`list_tasks`**: Spoken summary of open, completed, or all tasks, formatted specifically for audio synthesis (max 5 items with count overflow).
3. **`complete_task`**: Marks tasks done by numeric ID or spoken title substring. If multiple tasks match, it speaks an intelligent clarification prompt.
4. **`summarize_repo`**: Connects to the GitHub REST API to summarize the 3 latest commits and open issue counts (excluding pull requests) with an 8-second timeout and rate-limit detection.
5. **`run_workflow`**: Executes composite developer routines:
   - **`morning_setup`**: Automatically creates daily priority tasks and appends a real-time repository summary.
   - **`end_of_day`**: Summarizes remaining open items or congratulates you on completing everything.

The project includes a simulated voice demo interface (`GET /demo`) using the Web Speech API so anyone can test the voice experience directly in their browser without specialized hardware.

---

## How I Built It

- **Language & Runtime**: Node.js 20+ with TypeScript 5 in strict ESM mode (`"type": "module"`).
- **Web Framework**: Express 5 with streaming HTTP handlers.
- **MCP Core**: Official `@modelcontextprotocol/sdk` (`McpServer` and `StreamableHTTPServerTransport`) operating statelessly (`sessionIdGenerator: undefined`) per request.
- **Validation**: Zod schemas on every tool with detailed `.describe()` annotations enabling LLM intent resolution.
- **Audio Optimization Engine**: Custom speech synthesis helper (`src/services/speech.ts`) that strips emojis, cleans markdown artifacts, normalizes punctuation, and strictly bounds spoken output to under 300 characters.
- **Storage Layer**: Default in-memory store with optional JSON-file persistence (`TASKS_FILE`) and an optional Amazon DynamoDB store (`TASK_STORE=dynamodb`).
- **Cloud & Container**: Multi-stage Dockerfile running as non-root `nodejs` with native `/healthz` healthchecks, paired with AWS CloudFormation templates for DynamoDB and AWS App Runner.
- **Testing**: 41 unit and integration tests written in Vitest covering all tools, services, error handling, rate limiting, and Bearer token authentication.

---

## Challenges

1. **Audio-First Response Constraints**: Traditional MCP tools return markdown tables, code snippets, and emojis. Spoken by a voice assistant, raw markdown sounds robotic and cluttered. We designed a speech-cleaning pipeline that filters symbols and truncates sentences at word boundaries under 300 characters.
2. **Stateless Streamable HTTP Transport**: Adapting the MCP SDK's `StreamableHTTPServerTransport` to handle stateless per-request lifecycles in Express required ensuring clean connection and server shutdown on response closure.
3. **Ambiguity in Spoken Task Matching**: When a developer says *"Alexa, finish the auth task"*, there might be multiple matching tasks. Rather than guessing or crashing, `complete_task` returns a structured clarification question asking the user to choose by ID.

---

## What I Learned

- How to design MCP tools specifically for voice interfaces where brevity and clarity outweigh formatting.
- How the MCP 2025-11-25 Streamable HTTP transport functions under high-concurrency stateless workloads.
- Techniques for timing-safe bearer token verification (`crypto.timingSafeEqual`) to protect public endpoints.

---

## What's Next for Alexa TaskFlow

- Integration with Jira and GitHub Issues directly to create remote tracking issues by voice.
- Multi-user authentication support with OAuth 2.0 / Alexa Account Linking.
- Voice-driven pull request review approvals with security confirmation codes.
- `[Add any personal roadmap items here, e.g. testing with custom wake words on physical Echo devices]`
