import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServer, TOOL_NAMES } from '../../src/createServer.js';
import { InMemoryTaskStore } from '../../src/services/taskStore.js';
import { GitHubService } from '../../src/services/github.js';

describe('Tool Handlers', () => {
  let taskStore: InMemoryTaskStore;
  let githubService: GitHubService;
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    taskStore = new InMemoryTaskStore();
    githubService = new GitHubService();
    server = createServer({ taskStore, githubService });
  });

  const callTool = async (name: string, args: any) => {
    const registered = (server as any)._registeredTools[name];
    if (!registered) throw new Error(`Tool ${name} not found`);
    return await registered.handler(args, {} as any);
  };

  it('registers exactly the 5 specified tools', () => {
    const registeredNames = Object.keys((server as any)._registeredTools);
    expect(registeredNames.length).toBe(5);
    for (const name of TOOL_NAMES) {
      expect(registeredNames).toContain(name);
    }
  });

  it('has readOnlyHint set to true on list_tasks and summarize_repo', () => {
    const tools = (server as any)._registeredTools;
    expect(tools.list_tasks.annotations?.readOnlyHint).toBe(true);
    expect(tools.summarize_repo.annotations?.readOnlyHint).toBe(true);
    expect(tools.create_task.annotations?.readOnlyHint).toBe(false);
    expect(tools.complete_task.annotations?.readOnlyHint).toBe(false);
    expect(tools.run_workflow.annotations?.readOnlyHint).toBe(false);
  });

  describe('create_task', () => {
    it('creates a task and returns speakable confirmation with open count', async () => {
      const res = await callTool('create_task', { title: 'Implement rate limiter' });
      expect(res.isError).toBeUndefined();
      const text = res.content[0].text;
      expect(text).toBe('Added task 1: Implement rate limiter. You now have 1 open tasks.');
      expect(text.length).toBeLessThan(300);

      const tasks = await taskStore.listTasks('open');
      expect(tasks.length).toBe(1);
    });
  });

  describe('list_tasks', () => {
    it('returns spoken list of open tasks', async () => {
      await taskStore.addTask('Task Alpha');
      await taskStore.addTask('Task Beta');

      const res = await callTool('list_tasks', { status: 'open' });
      expect(res.isError).toBeUndefined();
      const text = res.content[0].text;
      expect(text).toBe('You have 2 open tasks: 1, Task Alpha; 2, Task Beta.');
    });

    it('returns speakable message when no tasks match', async () => {
      const res = await callTool('list_tasks', { status: 'open' });
      expect(res.content[0].text).toBe('You have no open tasks.');
    });
  });

  describe('complete_task', () => {
    it('completes task by numeric id', async () => {
      const task = await taskStore.addTask('Write docs');
      const res = await callTool('complete_task', { id: task.id });
      expect(res.isError).toBeUndefined();
      expect(res.content[0].text).toContain('Completed task 1: Write docs');
      expect(res.content[0].text).toContain('0 open tasks remaining');

      const updated = await taskStore.getTask(task.id);
      expect(updated?.status).toBe('done');
    });

    it('completes task by case-insensitive title substring', async () => {
      await taskStore.addTask('Prepare hackathon submission');
      const res = await callTool('complete_task', { title: 'HACKATHON' });
      expect(res.isError).toBeUndefined();
      expect(res.content[0].text).toContain('Completed task 1: Prepare hackathon submission');
    });

    it('returns isError with clarifying question if title is ambiguous', async () => {
      await taskStore.addTask('Write test for auth');
      await taskStore.addTask('Write test for rate limiter');

      const res = await callTool('complete_task', { title: 'Write test' });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('multiple matching tasks');
      expect(res.content[0].text).toContain('Which task ID would you like to complete?');
    });

    it('returns isError if task is not found', async () => {
      const res = await callTool('complete_task', { id: 999 });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('could not find task 999');
    });

    it('returns isError if neither id nor title is provided', async () => {
      const res = await callTool('complete_task', {});
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('Please specify a task ID or task title');
    });
  });

  describe('summarize_repo', () => {
    it('summarizes repository cleanly and speakably', async () => {
      vi.spyOn(githubService, 'summarizeRepo').mockResolvedValue({
        repo: 'facebook/react',
        commits: ['Fix hook bug', 'Update types', 'Bump version'],
        openIssuesCount: 42,
      });

      const res = await callTool('summarize_repo', { repo: 'facebook/react' });
      expect(res.isError).toBeUndefined();
      const text = res.content[0].text;
      expect(text).toContain('Repository facebook/react has 42 open issues');
      expect(text).toContain('Recent commits: Fix hook bug, Update types, Bump version');
      expect(text.length).toBeLessThan(300);
    });

    it('returns isError on failure without throwing stack trace', async () => {
      vi.spyOn(githubService, 'summarizeRepo').mockResolvedValue({
        isError: true,
        message: 'Repository not found: private/secret',
      });

      const res = await callTool('summarize_repo', { repo: 'private/secret' });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toBe('Repository not found: private/secret');
    });
  });

  describe('run_workflow', () => {
    it('runs morning_setup without repo', async () => {
      const res = await callTool('run_workflow', { name: 'morning_setup' });
      expect(res.isError).toBeUndefined();
      expect(res.content[0].text).toContain('Morning setup complete. Created tasks 1 and 2');

      const tasks = await taskStore.listTasks('open');
      expect(tasks.length).toBe(2);
      expect(tasks[0].title).toBe("Review yesterday's commits");
      expect(tasks[1].title).toBe('Pick top priority for today');
    });

    it('runs morning_setup with repo summary appended', async () => {
      vi.spyOn(githubService, 'summarizeRepo').mockResolvedValue({
        repo: 'modelcontextprotocol/typescript-sdk',
        commits: ['Commit A'],
        openIssuesCount: 3,
      });

      const res = await callTool('run_workflow', {
        name: 'morning_setup',
        repo: 'modelcontextprotocol/typescript-sdk',
      });
      expect(res.isError).toBeUndefined();
      expect(res.content[0].text).toContain('Morning setup complete. Created tasks 1 and 2.');
      expect(res.content[0].text).toContain(
        'Repository modelcontextprotocol/typescript-sdk has 3 open issues'
      );
    });

    it('runs end_of_day when tasks remain', async () => {
      await taskStore.addTask('Pending bug fix');
      const res = await callTool('run_workflow', { name: 'end_of_day' });
      expect(res.isError).toBeUndefined();
      expect(res.content[0].text).toContain('You have 1 open task: 1, Pending bug fix.');
    });

    it('runs end_of_day when all tasks are finished', async () => {
      const res = await callTool('run_workflow', { name: 'end_of_day' });
      expect(res.isError).toBeUndefined();
      expect(res.content[0].text).toBe('All done! You have no open tasks left today.');
    });
  });
});
