import { v4 as uuidv4 } from 'uuid';
import type { WebSocket } from 'ws';
import type { TaskEvent, TaskHandler } from '../types.js';

interface Task {
  id: string;
  toolId: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
  createdAt: number;
  events: TaskEvent[];
  subscribers: Set<WebSocket>;
  abortController: AbortController;
}

class TaskManager {
  private tasks = new Map<string, Task>();
  private handlers = new Map<string, TaskHandler>();

  registerHandler(toolId: string, handler: TaskHandler) {
    this.handlers.set(toolId, handler);
  }

  createTask(toolId: string, payload: unknown): string {
    const id = uuidv4();
    const abortController = new AbortController();
    const task: Task = {
      id,
      toolId,
      status: 'pending',
      createdAt: Date.now(),
      events: [],
      subscribers: new Set(),
      abortController,
    };
    this.tasks.set(id, task);

    const handler = this.handlers.get(toolId);
    if (!handler) {
      throw new Error(`No handler registered for tool: ${toolId}`);
    }

    task.status = 'running';
    handler(id, payload, (event) => this.emit(id, event), abortController.signal)
      .then(() => {
        if (task.status === 'running') {
          task.status = 'done';
        }
      })
      .catch((err) => {
        if (task.status !== 'cancelled') {
          task.status = 'error';
          this.emit(id, {
            type: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });

    return id;
  }

  cancelTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') return;

    task.abortController.abort();
    task.status = 'cancelled';
    this.emit(taskId, { type: 'cancelled' });
  }

  subscribe(taskId: string, ws: WebSocket) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.subscribers.add(ws);

    for (const event of task.events) {
      ws.send(JSON.stringify(event));
    }

    ws.on('close', () => {
      task.subscribers.delete(ws);
      if (task.status === 'running' && task.subscribers.size === 0) {
        this.cancelTask(taskId);
      }
    });
  }

  getTask(taskId: string) {
    return this.tasks.get(taskId);
  }

  private emit(taskId: string, event: TaskEvent) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.events.push(event);
    const data = JSON.stringify(event);
    for (const ws of task.subscribers) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }
}

export const taskManager = new TaskManager();
