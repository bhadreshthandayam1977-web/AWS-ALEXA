import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TaskStore } from '../services/taskStore.js';
import { formatTaskListSpeech, speakable } from '../services/speech.js';

export const listTasksSchema = {
  status: z
    .enum(['open', 'done', 'all'])
    .default('open')
    .describe('Filter tasks by status: open, done, or all. Defaults to open.'),
};

export function registerListTasks(server: McpServer, taskStore: TaskStore): void {
  (server as any).registerTool(
    'list_tasks',
    {
      title: 'List Tasks',
      description:
        'List developer tasks filtered by status. Use this when the user asks what are my tasks, show my todos, or what is on my list.',
      inputSchema: listTasksSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ status = 'open' }: { status?: 'open' | 'done' | 'all' }) => {
      try {
        const tasks = await taskStore.listTasks(status);
        const speech = formatTaskListSpeech(tasks, status);
        return {
          content: [{ type: 'text', text: speech }],
        };
      } catch (err: unknown) {
        return {
          content: [
            {
              type: 'text',
              text: speakable(`Could not list tasks: ${(err as Error).message}`),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
