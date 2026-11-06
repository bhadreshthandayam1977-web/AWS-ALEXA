import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Task, TaskStore } from './taskStore.js';

export interface DynamoConfig {
  tableName: string;
  region: string;
  endpoint?: string;
}

export class DynamoTaskStore implements TaskStore {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(cfg: DynamoConfig) {
    this.tableName = cfg.tableName;
    const client = new DynamoDBClient({
      region: cfg.region,
      endpoint: cfg.endpoint,
    });
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  private async getNextId(): Promise<number> {
    const res = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        ProjectionExpression: 'id',
      })
    );
    const items = (res.Items || []) as Array<{ id: number }>;
    if (items.length === 0) return 1;
    const maxId = items.reduce((max, cur) => (cur.id > max ? cur.id : max), 0);
    return maxId + 1;
  }

  async addTask(title: string): Promise<Task> {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error('Task title cannot be empty.');
    }
    const id = await this.getNextId();
    const task: Task = {
      id,
      title: trimmed,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: task,
      })
    );
    return task;
  }

  async getTask(id: number): Promise<Task | null> {
    const res = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { id },
      })
    );
    return (res.Item as Task) || null;
  }

  async listTasks(status: 'open' | 'done' | 'all' = 'open'): Promise<Task[]> {
    if (status === 'all') {
      const res = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
        })
      );
      return ((res.Items || []) as Task[]).sort((a, b) => a.id - b.id);
    }

    const res = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: '#st = :status',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: { ':status': status },
      })
    );
    return ((res.Items || []) as Task[]).sort((a, b) => a.id - b.id);
  }

  async completeTask(id: number): Promise<Task | null> {
    const existing = await this.getTask(id);
    if (!existing) return null;

    const completedAt = new Date().toISOString();
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: 'SET #st = :status, completedAt = :cat',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':status': 'done',
          ':cat': completedAt,
        },
      })
    );
    existing.status = 'done';
    existing.completedAt = completedAt;
    return existing;
  }

  async findTasksByTitle(query: string, status: 'open' | 'done' | 'all' = 'open'): Promise<Task[]> {
    const normalized = query.trim().toLowerCase();
    const all = await this.listTasks(status);
    return all.filter((t) => t.title.toLowerCase().includes(normalized));
  }

  async countOpenTasks(): Promise<number> {
    const openTasks = await this.listTasks('open');
    return openTasks.length;
  }

  async clear(): Promise<void> {
    const all = await this.listTasks('all');
    for (const item of all) {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { id: item.id },
        })
      );
    }
  }
}
