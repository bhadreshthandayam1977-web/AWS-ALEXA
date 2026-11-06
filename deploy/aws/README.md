# AWS Deployment Guide: Alexa TaskFlow

This guide provides end-to-end instructions for deploying the **Alexa TaskFlow** MCP server to AWS with an HTTPS endpoint, as part of the Amazon "Build, Ship, Shape" Developer Hackathon (AWS Builder mini-challenge).

---

## Architecture Overview

```
Alexa+ Voice / Client
       │ (HTTPS POST /mcp)
       ▼
AWS App Runner (or ECS Fargate)
  ├─ Container: alexa-taskflow (Node.js 20 Alpine)
  ├─ Env: PORT=3000, TASK_STORE=dynamodb
  ├─ Secret: API_TOKEN (from AWS Secrets Manager)
  └─ IAM Role: AlexaTaskFlowInstanceRole
       │
       ▼
Amazon DynamoDB (Table: alexa-taskflow-tasks)
```

---

## Prerequisites

1. AWS Account with Administrator or PowerUser permissions.
2. AWS CLI v2 configured (`aws configure`).
3. (Optional) Docker installed locally if building and pushing the container image to Amazon ECR.

---

## Step 1: Deploy DynamoDB & IAM Resources (CloudFormation)

Deploy the CloudFormation template provided in this directory:

```bash
aws cloudformation deploy \
  --template-file deploy/aws/cloudformation.yaml \
  --stack-name alexa-taskflow-infra \
  --parameter-overrides TableName=alexa-taskflow-tasks EnvironmentName=production \
  --capabilities CAPABILITY_NAMED_IAM
```

This creates:
- DynamoDB Table: `alexa-taskflow-tasks` (Pay-per-request billing, point-in-time recovery, KMS encryption).
- IAM Role: `alexa-taskflow-instance-role-production` with least-privilege policies for DynamoDB and Secrets Manager.

---

## Step 2: Store API_TOKEN in AWS Secrets Manager

Create a secret for authentication:

```bash
aws secretsmanager create-secret \
  --name "alexa-taskflow/api-token" \
  --description "Bearer token for Alexa TaskFlow MCP Server" \
  --secret-string '{"API_TOKEN":"your-high-entropy-random-secret"}'
```

---

## Step 3: Build & Push Container to Amazon ECR

1. **Create an ECR repository**:
   ```bash
   aws ecr create-repository \
     --repository-name alexa-taskflow \
     --image-scanning-configuration scanOnPush=true
   ```

2. **Authenticate Docker to your ECR registry**:
   ```bash
   ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   REGION=$(aws configure get region)
   aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
   ```

3. **Build, tag, and push the image**:
   ```bash
   docker build -t alexa-taskflow .
   docker tag alexa-taskflow:latest ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/alexa-taskflow:latest
   docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/alexa-taskflow:latest
   ```

---

## Step 4: Deploy on AWS App Runner (HTTPS URL out of the box)

AWS App Runner provides managed TLS certificates, automatic scaling, and health checks natively.

1. **Create App Runner Service via AWS CLI**:
   ```bash
   aws apprunner create-service \
     --service-name alexa-taskflow-service \
     --source-configuration '{
       "ImageRepository": {
         "ImageIdentifier": "'"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/alexa-taskflow:latest"'",
         "ImageConfiguration": {
           "Port": "3000",
           "RuntimeEnvironmentVariables": {
             "TASK_STORE": "dynamodb",
             "DYNAMODB_TABLE_NAME": "alexa-taskflow-tasks",
             "AWS_REGION": "'"${REGION}"'",
             "NODE_ENV": "production"
           },
           "RuntimeEnvironmentSecrets": {
             "API_TOKEN": "arn:aws:secretsmanager:'"${REGION}"':'"${ACCOUNT_ID}"':secret:alexa-taskflow/api-token:API_TOKEN::"
           }
         },
         "ImageRepositoryType": "ECR"
       },
       "AutoDeploymentsEnabled": true
     }' \
     --instance-configuration '{
       "Cpu": "1 vCPU",
       "Memory": "2 GB",
       "InstanceRoleArn": "arn:aws:iam::'"${ACCOUNT_ID}"':role/alexa-taskflow-instance-role-production"
     }' \
     --health-check-configuration '{
       "Protocol": "HTTP",
       "Path": "/healthz",
       "Interval": 10,
       "Timeout": 5,
       "HealthyThreshold": 1,
       "UnhealthyThreshold": 3
     }'
   ```

2. **Retrieve your HTTPS endpoint URL**:
   ```bash
   aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='alexa-taskflow-service'].ServiceUrl" --output text
   ```
   Example URL: `https://xyz123abc.us-east-1.awsapprunner.com`

---

## Step 5: Verify Deployment

1. **Verify Health Endpoint**:
   ```bash
   curl -i https://<your-service-url>.awsapprunner.com/healthz
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "name": "alexa-taskflow",
     "version": "1.0.0",
     "protocolVersion": "2025-11-25",
     "tools": ["create_task", "list_tasks", "complete_task", "summarize_repo", "run_workflow"]
   }
   ```

2. **Verify MCP Endpoint with Auth**:
   ```bash
   curl -i -X POST https://<your-service-url>.awsapprunner.com/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "Authorization: Bearer your-high-entropy-random-secret" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
   ```
