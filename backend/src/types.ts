export interface TaskProgressEvent {
  type: 'progress';
  step: string;
  status: 'running' | 'done' | 'error';
  data?: unknown;
  message?: string;
}

export interface TaskCompleteEvent {
  type: 'complete';
  result: unknown;
}

export interface TaskErrorEvent {
  type: 'error';
  message: string;
}

export interface BatchProgressEvent {
  type: 'batch_progress';
  current: number;
  total: number;
  path: string;
  status: 'running' | 'done' | 'error';
  data?: unknown;
}

export interface BatchCompleteEvent {
  type: 'batch_complete';
  batchIndex: number;
  results: unknown[];
  hasMore: boolean;
  nextStart: number;
}

export interface TaskCancelledEvent {
  type: 'cancelled';
}

export type TaskEvent =
  | TaskProgressEvent
  | TaskCompleteEvent
  | TaskErrorEvent
  | BatchProgressEvent
  | BatchCompleteEvent
  | TaskCancelledEvent;

export type TaskHandler = (
  taskId: string,
  payload: unknown,
  emit: (event: TaskEvent) => void,
  signal: AbortSignal
) => Promise<void>;
