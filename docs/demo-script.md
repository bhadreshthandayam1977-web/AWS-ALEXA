# Demo Video Script: Alexa TaskFlow

**Target Duration**: 2 minutes 45 seconds (Strictly under 3:00 Devpost requirement)  
**Tone**: Confident, technical, developer-advocate pacing.  
**Visual Setup**: Split screen or Picture-in-Picture:
- Left: Browser window showing the simulated Alexa+ experience (`http://localhost:3000/demo`)
- Right: Terminal window showing live server logs (`npm run dev`) with JSON-RPC output visible
- VS Code editor for code walkthrough section

---

## Timed Script

### [0:00 - 0:20] The Hook (20 seconds)

- **Visual**: Developer looking frustrated trying to type tasks while multitasking, then looking up to speak.
- **Audio / Voiceover**:
  > "Every developer knows the friction: you're walking, making coffee, or in the middle of a build, and you have an idea for a task. But you have to unlock your laptop, open a tracker, and break your flow.
  > What if your voice assistant was connected directly to your developer tools?
  > Welcome to **Alexa TaskFlow**—a self-hosted Model Context Protocol server that brings real developer workflows to Alexa+ by voice."

---

### [0:20 - 1:30] Live Voice Demonstration & Live Server Logs (70 seconds)

- **Visual**: Split screen. Browser at `http://localhost:3000/demo` and Terminal running the server.
- **Audio / Voiceover**:
  > "Let's see it in action using our simulated Alexa+ voice console, connected via Streamable HTTP."

- **[0:25 - 0:45] Action 1: Create Task**
  - **Spoken Input**: *"Add task: Review the authentication pull request"*
  - **Terminal Log Shows**: `{"type":"tool_call","tool":"create_task","durationMs":8,"status":200}`
  - **Alexa+ Speaks**: *"Added task 1: Review the authentication pull request. You now have 1 open tasks."*
  - **UI Updates**: Live Task List displays task #1 in real time.

- **[0:45 - 1:05] Action 2: Morning Setup Workflow**
  - **Spoken Input**: *"Start my morning setup for repo modelcontextprotocol/typescript-sdk"*
  - **Terminal Log Shows**: `{"type":"tool_call","tool":"run_workflow","durationMs":340,"status":200}`
  - **Alexa+ Speaks**: *"Morning setup complete. Created tasks 2 and 3. Repository modelcontextprotocol/typescript-sdk has 14 open issues."*
  - **UI Updates**: Tasks list adds "Review yesterday's commits" and "Pick top priority for today".

- **[1:05 - 1:20] Action 3: Ambiguity Resolution on Complete Task**
  - **Spoken Input**: *"Complete the review task"*
  - **Terminal Log Shows**: `{"type":"tool_call","tool":"complete_task","durationMs":4,"status":200}`
  - **Alexa+ Speaks**: *"I found multiple matching tasks: 1: Review the authentication pull request or 2: Review yesterday's commits. Which task ID would you like to complete?"*
  - **Voiceover**: *"Notice how TaskFlow handles ambiguity cleanly without crashing or guessing."*

- **[1:20 - 1:30] Action 4: Confirm Completion**
  - **Spoken Input**: *"Complete task 1"*
  - **Alexa+ Speaks**: *"Completed task 1: Review the authentication pull request. You have 2 open tasks remaining."*

---

### [1:30 - 2:20] Code Architecture & Technical Deep-Dive (50 seconds)

- **Visual**: Switch to VS Code showing `src/createServer.ts` and `src/tools/createTask.ts`.
- **Audio / Voiceover**:
  > "Under the hood, Alexa TaskFlow is built with modern TypeScript 5, Express 5, and the official Model Context Protocol SDK.
  > Let's look at `createServer.ts`: here we instantiate `McpServer` and register our 5 tools using clean Zod schemas.
  > Every parameter has `.describe()` annotations so the LLM correctly parses natural spoken language into typed parameters.
  > And in `createTask.ts`, notice how every response passes through our `speakable()` engine: we strip emojis, clean markdown asterisks, and strictly enforce sub-300-character bounds so answers sound natural when spoken aloud.
  > The transport uses stateless Streamable HTTP over `POST /mcp` with constant-time Bearer token verification and IP rate limiting."

---

### [2:20 - 2:45] Cloud Deployment, Open Source & Wrap-Up (25 seconds)

- **Visual**: Show AWS App Runner / DynamoDB architecture diagram from README, then GitHub repository.
- **Audio / Voiceover**:
  > "For production, TaskFlow includes a multi-stage Dockerfile, AWS CloudFormation templates for Amazon DynamoDB and AWS App Runner, and 41 automated tests in Vitest.
  > It is fully open-source under the MIT license.
  > Alexa TaskFlow brings voice-driven productivity to software engineering.
  > Thank you!"

---

## Shot List & Recording Checklist

| Shot # | Timestamp | Framing / Screen | Content / Focus |
| :--- | :--- | :--- | :--- |
| **1** | 0:00 - 0:20 | Camera or Title Card | Problem statement & intro hook |
| **2** | 0:20 - 0:45 | Split Screen (Browser + Terminal) | `create_task` voice test + real-time JSON log |
| **3** | 0:45 - 1:05 | Split Screen (Browser + Terminal) | `run_workflow` (`morning_setup`) with GitHub repo query |
| **4** | 1:05 - 1:30 | Split Screen (Browser + Terminal) | `complete_task` ambiguity clarification dialog |
| **5** | 1:30 - 2:05 | VS Code fullscreen | `src/createServer.ts` & Zod tool registration |
| **6** | 2:05 - 2:20 | VS Code fullscreen | `src/services/speech.ts` speech sanitization |
| **7** | 2:20 - 2:45 | Browser / Slides | AWS App Runner / DynamoDB architecture & GitHub repo |

---

## Important Video Guidelines (What NOT to Include)

- **No Copyrighted Music**: Do not use commercial background tracks. Use silence or royalty-free ambient music at low volume.
- **No Third-Party Logos**: Do not display unauthorized company logos or commercial trademarks.
- **Keep Under 3:00 Minutes**: Devpost disqualifies videos that exceed the 3-minute limit. Target exactly 2:45.
- **Ensure Audio Clarity**: Use a dedicated microphone without room echo.
- **Show Real Logs**: Keep the terminal visible during tool calls to prove the server is running real MCP code.
