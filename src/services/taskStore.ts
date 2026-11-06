import fs from 'node:fs';
import path from 'node:path';

export interface Task {
  id: number;
  title: string;
  status: 'open' | 'done';
  createdAt: string;
  completedAt?: string;
}

export interface TaskStore {
  addTask(title: string): Promise<Task>;
  getTask(id: number): Promise<Task | null>;
  listTasks(status?: 'open' | 'done' | 'all'): Promise<Task[]>;
  completeTask(id: number): Promise<Task | null>;
  findTasksByTitle(query: string, status?: 'open' | 'done' | 'all'): Promise<Task[]>;
  countOpenTasks(): Promise<number>;
  clear(): Promise<void>;
}

export class InMemoryTaskStore implements TaskStore {
  private tasks: Map<number, Task> = new Map();
  private nextId = 1;
  private filePath?: string;

  constructor(filePath?: string) {
    this.filePath = filePath;
    if (this.filePath) {
      this.loadFromFile();
    }
  }

  private loadFromFile(): void {
    if (!this.filePath) return;
    try {
      const resolvedPath = path.resolve(this.filePath);
      if (fs.existsSync(resolvedPath)) {
        const raw = fs.readFileSync(resolvedPath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          let maxId = 0;
          for (const item of data) {
            if (item && typeof item.id === 'number' && typeof item.title === 'string') {
              const task: Task = {
                id: item.id,
                title: item.title,
                status: item.status === 'done' ? 'done' : 'open',
                createdAt: item.createdAt || new Date().toISOString(),
                completedAt: item.completedAt,
              };
              this.tasks.set(item.id, task);
              if (item.id > maxId) maxId = item.id;
            }
          }
          this.nextId = maxId + 1;
        }
      }
    } catch (err) {
      // Start with empty store if file is unreadable or malformed
      console.warn(`Warning: Could not read tasks file ${this.filePath}:`, (err as Error).message);
    }
  }

  private saveToFile(): void {
    if (!this.filePath) return;
    try {
      const resolvedPath = path.resolve(this.filePath);
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.tasks.values());
      fs.writeFileSync(resolvedPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(
        `Error: Could not save tasks to file ${this.filePath}:`,
        (err as Error).message
      );
    }
  }

  async addTask(title: string): Promise<Task> {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error('Task title cannot be empty.');
    }
    const id = this.nextId++;
    const task: Task = {
      id,
      title: trimmed,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.tasks.set(id, task);
    this.saveToFile();
    return task;
  }

  async getTask(id: number): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async listTasks(status: 'open' | 'done' | 'all' = 'open'): Promise<Task[]> {
    const all = Array.from(this.tasks.values());
    if (status === 'all') {
      return all;
    }
    return all.filter((t) => t.status === status);
  }

  async completeTask(id: number): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) {
      return null;
    }
    task.status = 'done';
    task.completedAt = new Date().toISOString();
    this.tasks.set(id, task);
    this.saveToFile();
    return task;
  }

  async findTasksByTitle(query: string, status: 'open' | 'done' | 'all' = 'open'): Promise<Task[]> {
    const normalized = query.trim().toLowerCase();
    const candidateTasks = await this.listTasks(status);
    return candidateTasks.filter((t) => t.title.toLowerCase().includes(normalized));
  }

  async countOpenTasks(): Promise<number> {
    const openTasks = await this.listTasks('open');
    return openTasks.length;
  }

  async clear(): Promise<void> {
    this.tasks.clear();
    this.nextId = 1;
    this.saveToFile();
  }
}
