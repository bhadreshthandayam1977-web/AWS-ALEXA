# AWS Builder Mini-Challenge: Alexa TaskFlow Writeup

> **Note for Author (Bhadresh):** Devpost requires truthful, verifiable project descriptions. This writeup template distinguishes between code-ready AWS integrations and the live deployment state. Fill in the bracketed placeholders `[...]` based on what you actually deploy before final submission.

---

## AWS Services Integrated

Alexa TaskFlow implements native code paths and deployment configurations for the following AWS services:

1. **Amazon DynamoDB**:
   - **Integration Code**: [`src/services/taskStoreDynamo.ts`](file:///c:/Users/bhadr/Desktop/AWS%20ALEXA/src/services/taskStoreDynamo.ts)
   - **Implementation**: Uses `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` to provide persistent, multi-container task storage with pay-per-request billing and point-in-time recovery.
   - **Activation**: Selected via environment variable `TASK_STORE=dynamodb`.
   - **Infrastructure**: Automated via CloudFormation template [`deploy/aws/cloudformation.yaml`](file:///c:/Users/bhadr/Desktop/AWS%20ALEXA/deploy/aws/cloudformation.yaml).

2. **AWS App Runner** (or Amazon ECS Fargate):
   - **Configuration**: Fully containerized with multi-stage [`Dockerfile`](file:///c:/Users/bhadr/Desktop/AWS%20ALEXA/Dockerfile).
   - **Security**: Runs under a non-root `nodejs` user, exposing port 3000 with a native `/healthz` health check.
   - **TLS & Domain**: App Runner provides managed TLS certificates and a public HTTPS endpoint required by Alexa+.

3. **AWS Secrets Manager**:
   - **Security Integration**: Stores the bearer authentication secret `API_TOKEN`.
   - **Access**: Injected directly as a secure environment variable in App Runner via the IAM instance role.

---

## Submission Status Statement

*Select and confirm one of the following for your Devpost writeup:*

- [ ] **Option A (Live AWS Deployment Verified)**:
  "For the AWS Builder challenge, I deployed Alexa TaskFlow on AWS App Runner using the provided multi-stage Docker container. The MCP endpoint is accessible at `https://[YOUR_APP_RUNNER_URL].awsapprunner.com/mcp`. Tasks are persistently stored in an Amazon DynamoDB table (`alexa-taskflow-tasks`), and the API bearer token is stored and resolved through AWS Secrets Manager."

- [ ] **Option B (Code-Ready Architecture / Local Simulation)**:
  "For the AWS Builder challenge, I developed a production-ready AWS integration including a native DynamoDB storage adapter (`src/services/taskStoreDynamo.ts`), an AWS CloudFormation infrastructure template (`deploy/aws/cloudformation.yaml`), and an AWS App Runner deployment configuration. In my local demonstration video, the server ran using the in-memory store, with the DynamoDB code path ready for one-command deployment via CloudFormation."
