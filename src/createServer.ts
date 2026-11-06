import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TaskStore } from './services/taskStore.js';
import type { GitHubService } from './services/github.js';
import { registerCreateTask } from './tools/createTask.js';
import { registerListTasks } from './tools/listTasks.js';
import { registerCompleteTask } from './tools/completeTask.js';
import { registerSummarizeRepo } from './tools/summarizeRepo.js';
import { registerRunWorkflow } from './tools/runWorkflow.js';

export const TOOL_NAMES = [
  'create_task',
  'list_tasks',
  'complete_task',
  'summarize_repo',
  'run_workflow',
] as const;

export interface CreateServerOptions {
  taskStore: TaskStore;
  githubService: GitHubService;
}

/**
 * Builds and returns a fresh McpServer instance with all 5 developer workflow tools registered.
 */
export function createServer(options: CreateServerOptions): McpServer {
  const server = new McpServer({
    name: 'alexa-taskflow',
    version: '1.0.0',
  });

  registerCreateTask(server, options.taskStore);
  registerListTasks(server, options.taskStore);
  registerCompleteTask(server, options.taskStore);
  registerSummarizeRepo(server, options.githubService);
  registerRunWorkflow(server, options.taskStore, options.githubService);

  return server;
}
