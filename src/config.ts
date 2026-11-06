import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().int().min(0).default(3000),
  API_TOKEN: z.string().min(1).optional(),
  GITHUB_TOKEN: z.string().min(1).optional(),
  TASKS_FILE: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),
  TASK_STORE: z.enum(['memory', 'dynamodb']).default('memory'),
  AWS_REGION: z.string().default('us-east-1'),
  DYNAMODB_TABLE_NAME: z.string().default('alexa-taskflow-tasks'),
  NODE_ENV: z.string().default('development'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Invalid configuration: ${errorDetails}`);
  }
  return result.data;
}

export const config = loadConfig();
