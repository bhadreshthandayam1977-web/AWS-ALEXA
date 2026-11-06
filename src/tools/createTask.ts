import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TaskStore } from '../services/taskStore.js';
import { speakable } from '../services/speech.js';

export const createTaskSchema = {
  title: z
    .string()
    .min(1, 'Task title must contain at least 1 character')
    .max(200, 'Task title cannot exceed 200 characters')
    .describe('The title or description of the task to add to your list.'),
};

export function registerCreateTask(server: McpServer, taskStore: TaskStore): void {
  (server as any).registerTool(
    'create_task',
    {
      title: 'Create Task',
      description:
        'Add a new task or reminder to your developer task list. Use this when the user says add a task, create a todo, or remind me to do something.',
      inputSchema: createTaskSchema,
      annotations: {
        readOnlyHint: false,
      },
    },
    async ({ title }: { title: string }) => {
      try {
        const task = await taskStore.addTask(title);
        const openCount = await taskStore.countOpenTasks();
        const speech = speakable(
          `Added task ${task.id}: ${task.title}. You now have ${openCount} open tasks.`
        );
        return {
          content: [{ type: 'text', text: speech }],
        };
      } catch (err: unknown) {
        return {
          content: [
            {
              type: 'text',
              text: speakable(`Could not create task: ${(err as Error).message}`),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
