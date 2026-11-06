import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TaskStore } from '../services/taskStore.js';
import type { GitHubService } from '../services/github.js';
import { formatTaskListSpeech, speakable } from '../services/speech.js';

export interface WorkflowContext {
  taskStore: TaskStore;
  githubService: GitHubService;
}

export type WorkflowFn = (args: { repo?: string }, ctx: WorkflowContext) => Promise<string>;

/**
 * Workflow registry mapping workflow names to implementation functions.
 * Adding a new workflow requires only a new entry here.
 */
export const workflowRegistry: Record<string, WorkflowFn> = {
  morning_setup: async ({ repo }, { taskStore, githubService }) => {
    const task1 = await taskStore.addTask("Review yesterday's commits");
    const task2 = await taskStore.addTask('Pick top priority for today');
    let speech = `Morning setup complete. Created tasks ${task1.id} and ${task2.id}.`;

    if (repo && repo.trim()) {
      const cleanRepo = repo.trim();
      const summary = await githubService.summarizeRepo(cleanRepo);
      if ('isError' in summary && summary.isError) {
        speech += ` Repository note: ${summary.message}`;
      } else {
        const repoSummary = summary as import('../services/github.js').RepoSummary;
        const issueLabel =
          repoSummary.openIssuesCount === 1
            ? '1 open issue'
            : `${repoSummary.openIssuesCount} open issues`;
        speech += ` Repository ${repoSummary.repo} has ${issueLabel}.`;
      }
    }

    return speakable(speech, 300);
  },

  end_of_day: async (_args, { taskStore }) => {
    const openTasks = await taskStore.listTasks('open');
    if (openTasks.length === 0) {
      return speakable('All done! You have no open tasks left today.');
    }
    return formatTaskListSpeech(openTasks, 'open');
  },
};

// Derive the enum dynamically from the registry keys
const workflowKeys = Object.keys(workflowRegistry) as [string, ...string[]];

export const runWorkflowSchema = {
  name: z
    .enum(workflowKeys)
    .describe('The developer workflow to run: morning_setup or end_of_day.'),
  repo: z
    .string()
    .optional()
    .describe(
      'Optional GitHub repository in owner/repo format to include in the morning_setup summary.'
    ),
};

export function registerRunWorkflow(
  server: McpServer,
  taskStore: TaskStore,
  githubService: GitHubService
): void {
  (server as any).registerTool(
    'run_workflow',
    {
      title: 'Run Developer Workflow',
      description:
        'Run pre-configured multi-step developer workflows such as morning_setup or end_of_day. Use this when the user says start my morning setup, plan my day, or wrap up my day.',
      inputSchema: runWorkflowSchema,
      annotations: {
        readOnlyHint: false,
      },
    },
    async ({ name, repo }: { name: 'morning_setup' | 'end_of_day'; repo?: string }) => {
      try {
        const handler = workflowRegistry[name];
        if (!handler) {
          return {
            content: [
              {
                type: 'text',
                text: speakable(
                  `Unknown workflow "${name}". Available workflows: ${workflowKeys.join(', ')}.`
                ),
              },
            ],
            isError: true,
          };
        }

        const speech = await handler({ repo }, { taskStore, githubService });
        return {
          content: [{ type: 'text', text: speech }],
        };
      } catch (err: unknown) {
        return {
          content: [
            {
              type: 'text',
              text: speakable(`Could not run workflow ${name}: ${(err as Error).message}`),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
