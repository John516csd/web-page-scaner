import cron from 'node-cron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');

export interface ScheduledJob {
  id: string;
  toolId: string;
  cron: string;
  enabled: boolean;
  config: Record<string, unknown>;
  lastRun?: {
    time: string;
    success: boolean;
    summary?: unknown;
  };
}

type JobHandler = (job: ScheduledJob) => Promise<{ success: boolean; summary?: unknown }>;

class SchedulerClass {
  private jobs: Map<string, ScheduledJob> = new Map();
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private handlers: Map<string, JobHandler> = new Map();
  private initialized = false;

  async init() {
    if (this.initialized) return;

    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
      const data = await fs.readFile(SCHEDULES_FILE, 'utf-8');
      const jobs = JSON.parse(data) as ScheduledJob[];
      for (const job of jobs) {
        this.jobs.set(job.id, job);
        if (job.enabled) {
          this.scheduleJob(job);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to load schedules:', error);
      }
    }

    this.initialized = true;
  }

  registerHandler(toolId: string, handler: JobHandler) {
    this.handlers.set(toolId, handler);
  }

  private async saveJobs() {
    const jobs = Array.from(this.jobs.values());
    await fs.writeFile(SCHEDULES_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
  }

  private scheduleJob(job: ScheduledJob) {
    if (!cron.validate(job.cron)) {
      console.error(`Invalid cron expression for job ${job.id}: ${job.cron}`);
      return;
    }

    const task = cron.schedule(
      job.cron,
      async () => {
        const handler = this.handlers.get(job.toolId);
        if (!handler) {
          console.error(`No handler registered for tool ${job.toolId}`);
          return;
        }

        console.log(`Running scheduled job ${job.id} (${job.toolId})`);
        try {
          const result = await handler(job);
          job.lastRun = {
            time: new Date().toISOString(),
            success: result.success,
            summary: result.summary,
          };
          await this.saveJobs();
        } catch (error) {
          console.error(`Scheduled job ${job.id} failed:`, error);
          job.lastRun = {
            time: new Date().toISOString(),
            success: false,
          };
          await this.saveJobs();
        }
      },
      { scheduled: false }
    );

    this.tasks.set(job.id, task);
    task.start();
  }

  private unscheduleJob(jobId: string) {
    const task = this.tasks.get(jobId);
    if (task) {
      task.stop();
      this.tasks.delete(jobId);
    }
  }

  async register(job: ScheduledJob) {
    this.jobs.set(job.id, job);
    await this.saveJobs();

    if (job.enabled) {
      this.scheduleJob(job);
    }
  }

  async unregister(jobId: string) {
    this.unscheduleJob(jobId);
    this.jobs.delete(jobId);
    await this.saveJobs();
  }

  async enable(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.enabled = true;
    await this.saveJobs();
    this.scheduleJob(job);
  }

  async disable(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.enabled = false;
    await this.saveJobs();
    this.unscheduleJob(jobId);
  }

  async updateCron(jobId: string, cronExpr: string) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    if (!cron.validate(cronExpr)) {
      throw new Error(`Invalid cron expression: ${cronExpr}`);
    }

    job.cron = cronExpr;
    await this.saveJobs();

    if (job.enabled) {
      this.unscheduleJob(jobId);
      this.scheduleJob(job);
    }
  }

  async updateConfig(jobId: string, config: Record<string, unknown>) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.config = config;
    await this.saveJobs();
  }

  getJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  getJob(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  async runNow(jobId: string): Promise<{ success: boolean; summary?: unknown }> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const handler = this.handlers.get(job.toolId);
    if (!handler) throw new Error(`No handler registered for tool ${job.toolId}`);

    const result = await handler(job);
    job.lastRun = {
      time: new Date().toISOString(),
      success: result.success,
      summary: result.summary,
    };
    await this.saveJobs();

    return result;
  }
}

export const scheduler = new SchedulerClass();
