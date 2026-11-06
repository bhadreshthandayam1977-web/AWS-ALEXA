import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { InMemoryTaskStore } from '../../src/services/taskStore.js';

describe('InMemoryTaskStore', () => {
  let store: InMemoryTaskStore;
  let tmpFile: string;

  beforeEach(() => {
    store = new InMemoryTaskStore();
    tmpFile = path.join(os.tmpdir(), `tasks-test-${Date.now()}-${Math.random()}.json`);
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // ignore
      }
    }
  });

  it('adds and retrieves tasks with auto-incrementing IDs', async () => {
    const t1 = await store.addTask('First task');
    const t2 = await store.addTask('Second task');

    expect(t1.id).toBe(1);
    expect(t1.title).toBe('First task');
    expect(t1.status).toBe('open');
    expect(t2.id).toBe(2);
    expect(t2.title).toBe('Second task');

    const retrieved = await store.getTask(1);
    expect(retrieved).toEqual(t1);
  });

  it('rejects empty or whitespace task titles', async () => {
    await expect(store.addTask('')).rejects.toThrow('Task title cannot be empty.');
    await expect(store.addTask('   ')).rejects.toThrow('Task title cannot be empty.');
  });

  it('completes a task and updates open count', async () => {
    const t1 = await store.addTask('Task 1');
    const t2 = await store.addTask('Task 2');

    expect(await store.countOpenTasks()).toBe(2);

    const completed = await store.completeTask(t1.id);
    expect(completed?.status).toBe('done');
    expect(completed?.completedAt).toBeDefined();

    expect(await store.countOpenTasks()).toBe(1);

    const openList = await store.listTasks('open');
    expect(openList.length).toBe(1);
    expect(openList[0].id).toBe(t2.id);

    const doneList = await store.listTasks('done');
    expect(doneList.length).toBe(1);
    expect(doneList[0].id).toBe(t1.id);

    const allList = await store.listTasks('all');
    expect(allList.length).toBe(2);
  });

  it('finds tasks by title case-insensitively', async () => {
    await store.addTask('Review Authentication PR');
    await store.addTask('Fix authentication bug');
    await store.addTask('Deploy to AWS App Runner');

    const matches = await store.findTasksByTitle('auth');
    expect(matches.length).toBe(2);
    expect(matches[0].title).toContain('Authentication');
    expect(matches[1].title).toContain('authentication');
  });

  it('persists tasks to a JSON file and reloads them', async () => {
    const fileStore = new InMemoryTaskStore(tmpFile);
    await fileStore.addTask('Persistent Task 1');
    await fileStore.addTask('Persistent Task 2');
    await fileStore.completeTask(1);

    expect(fs.existsSync(tmpFile)).toBe(true);

    // Create a new store instance pointing to the same file
    const reloadedStore = new InMemoryTaskStore(tmpFile);
    const all = await reloadedStore.listTasks('all');
    expect(all.length).toBe(2);
    expect(all[0].id).toBe(1);
    expect(all[0].status).toBe('done');
    expect(all[1].id).toBe(2);
    expect(all[1].status).toBe('open');

    // Adding next task should pick next available id (3)
    const t3 = await reloadedStore.addTask('Persistent Task 3');
    expect(t3.id).toBe(3);
  });

  it('handles missing or corrupt persistence files gracefully', async () => {
    const corruptFile = path.join(os.tmpdir(), `corrupt-${Date.now()}.json`);
    fs.writeFileSync(corruptFile, 'INVALID JSON CONTENT', 'utf-8');

    const tolerantStore = new InMemoryTaskStore(corruptFile);
    const tasks = await tolerantStore.listTasks('all');
    expect(tasks).toEqual([]);

    // Can still add tasks
    const t = await tolerantStore.addTask('After corrupt');
    expect(t.id).toBe(1);

    fs.unlinkSync(corruptFile);
  });
});
