# Devpost Submission Checklist: Alexa TaskFlow

**Hackathon**: Amazon "Build, Ship, Shape" Developer Hackathon  
**Submission Deadline**: October 23, 2026 at 12:00 PM PDT  
**Track**: Alexa+ Track  
**Optional Mini-Challenges**: AWS Builder & Open Source  

---

## Eligibility & Rules Verification

| Requirement | Devpost Rule | Implementation in alexa-taskflow | Status |
| :--- | :--- | :--- | :--- |
| **Public Repository** | Must provide a public GitHub URL | Repo contains all code, Dockerfile, scripts, tests | `[Author must create GitHub repo]` |
| **Visible Open Source License** | Public repository with an open source license | Root [`LICENSE`](file:///c:/Users/bhadr/Desktop/AWS%20ALEXA/LICENSE) file with MIT License: `Copyright (c) 2026 Bhadresh` | **READY** |
| **Real MCP Code** | Must call MCP in real code (SDK import, entry point), not just README mention | Uses `@modelcontextprotocol/sdk` in `server.ts`, `createServer.ts`, `tools/*` with Streamable HTTP transport | **READY** |
| **MCP Protocol Spec** | MCP spec 2025-11-25 or later, Streamable HTTP | `LATEST_PROTOCOL_VERSION` (2025-11-25) verified; stateless Streamable HTTP over `POST /mcp` | **READY** |
| **Language** | All materials, documentation, and video in English | Code, docs, demo UI, and test suites are 100% English | **READY** |
| **Video Duration** | Demonstration video strictly under 3 minutes (180 seconds) | Script in [`docs/demo-script.md`](file:///c:/Users/bhadr/Desktop/AWS%20ALEXA/docs/demo-script.md) timed for 2:45 | `[Author to record & upload]` |
| **Video Access** | Publicly accessible (YouTube, Vimeo, or Loom) | Video must be marked Public or Unlisted (not private) | `[Author to paste URL]` |
| **Product Feedback** | Answer product feedback questions on Devpost | Pre-written drafts in [`docs/feedback-answers.md`](file:///c:/Users/bhadr/Desktop/AWS%20ALEXA/docs/feedback-answers.md) | **READY** |
| **Project Story** | Devpost story detailing inspiration, build, and challenges | Complete draft in [`docs/devpost-story.md`](file:///c:/Users/bhadr/Desktop/AWS%20ALEXA/docs/devpost-story.md) | **READY** |
| **AWS Integration (Optional)** | Documented AWS service integration for AWS Builder challenge | DynamoDB client (`taskStoreDynamo.ts`), CloudFormation (`cloudformation.yaml`), App Runner guide | **READY** |

---

## Action Items for Author (Bhadresh)

1. **Step 1: Push to GitHub**:
   - Create a new public repository: `https://github.com/[your-username]/alexa-taskflow`.
   - Run `git init`, `git add .`, `git commit -m "Initial commit of Alexa TaskFlow"`, and push to `main`.
2. **Step 2: Register Endpoint with Alexa+**:
   - Start local tunnel via `ngrok http 3000` (or deploy to AWS App Runner via [`deploy/aws/README.md`](file:///c:/Users/bhadr/Desktop/AWS%20ALEXA/deploy/aws/README.md)).
   - Follow instructions in the hackathon Devpost Resources tab to register your `https://<host>/mcp` endpoint and `API_TOKEN`.
3. **Step 3: Record and Upload Demo Video**:
   - Follow [`docs/demo-script.md`](file:///c:/Users/bhadr/Desktop/AWS%20ALEXA/docs/demo-script.md) (2:45 target).
   - Ensure terminal logs are visible while triggering tools in the demo UI.
   - Upload as Public or Unlisted on YouTube/Loom and paste the link into your Devpost entry.
4. **Step 4: Complete Devpost Submission Form**:
   - Copy story from [`docs/devpost-story.md`](file:///c:/Users/bhadr/Desktop/AWS%20ALEXA/docs/devpost-story.md).
   - Copy product feedback answers from [`docs/feedback-answers.md`](file:///c:/Users/bhadr/Desktop/AWS%20ALEXA/docs/feedback-answers.md).
   - Submit before **October 23, 2026 at 12:00 PM PDT**!
