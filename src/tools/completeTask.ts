import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TaskStore, Task } from '../services/taskStore.js';
import { speakable } from '../services/speech.js';

export const completeTaskSchema = {
  id: z.number().int().positive().optional().describe('The numeric ID of the task to complete.'),
  title: z
    .string()
    .min(1)
    .optional()
    .describe('The title or partial name of the task to complete.'),
};

export function registerCompleteTask(server: McpServer, taskStore: TaskStore): void {
  (server as any).registerTool(
    'complete_task',
    {
      title: 'Complete Task',
      description:
        'Mark a task as finished by its numeric ID or title. Use this when the user says finish task, complete task, done with task, or mark item as done.',
      inputSchema: completeTaskSchema,
      annotations: {
        readOnlyHint: false,
      },
    },
    async ({ id, title }: { id?: number; title?: string }) => {
      try {
        if (id === undefined && (!title || !title.trim())) {
          return {
            content: [
              {
                type: 'text',
                text: 'Please specify a task ID or task title to complete.',
              },
            ],
            isError: true,
          };
        }

        let targetTask: Task | null = null;

        if (id !== undefined) {
          targetTask = await taskStore.getTask(id);
          if (!targetTask) {
            return {
              content: [
                {
                  type: 'text',
                  text: speakable(
                    `I could not find task ${id}. Which task would you like to complete?`
                  ),
                },
              ],
              isError: true,
            };
          }
        } else if (title) {
          // Search open tasks first
          let matches = await taskStore.findTasksByTitle(title, 'open');
          if (matches.length === 0) {
            // Check all tasks
            matches = await taskStore.findTasksByTitle(title, 'all');
          }

          if (matches.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: speakable(
                    `I could not find any task matching "${title}". Which task would you like to complete?`
                  ),
                },
              ],
              isError: true,
            };
          }

          if (matches.length > 1) {
            const options = matches
              .slice(0, 3)
              .map((t) => `${t.id}: ${t.title}`)
              .join(' or ');
            return {
              content: [
                {
                  type: 'text',
                  text: speakable(
                    `I found multiple matching tasks: ${options}. Which task ID would you like to complete?`
                  ),
                },
              ],
              isError: true,
            };
          }

          targetTask = matches[0];
        }

        if (!targetTask) {
          return {
            content: [
              {
                type: 'text',
                text: 'Could not determine which task to complete.',
              },
            ],
            isError: true,
          };
        }

        const completed = await taskStore.completeTask(targetTask.id);
        const openRemaining = await taskStore.countOpenTasks();
        const speech = speakable(
          `Completed task ${completed?.id ?? targetTask.id}: ${completed?.title ?? targetTask.title}. You have ${openRemaining} open tasks remaining.`
        );

        return {
          content: [{ type: 'text', text: speech }],
        };
      } catch (err: unknown) {
        return {
          content: [
            {
              type: 'text',
              text: speakable(`Could not complete task: ${(err as Error).message}`),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
