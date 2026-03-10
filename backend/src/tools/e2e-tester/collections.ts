import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { E2ETestCase, E2ETestCollection } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../data');
const COLLECTIONS_FILE = path.join(DATA_DIR, 'e2e-collections.json');

class E2ECollectionStore {
  private collections: Map<string, E2ETestCollection> = new Map();
  private initialized = false;

  async init() {
    if (this.initialized) return;
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
      const data = await fs.readFile(COLLECTIONS_FILE, 'utf-8');
      const items = JSON.parse(data) as E2ETestCollection[];
      for (const c of items) {
        this.collections.set(c.id, c);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to load e2e collections:', error);
      }
    }

    this.initialized = true;
  }

  private async save() {
    const items = Array.from(this.collections.values());
    await fs.writeFile(COLLECTIONS_FILE, JSON.stringify(items, null, 2), 'utf-8');
  }

  getAll(): E2ETestCollection[] {
    return Array.from(this.collections.values());
  }

  getById(id: string): E2ETestCollection | undefined {
    return this.collections.get(id);
  }

  async create(data: { name: string; description?: string; testCases: E2ETestCase[] }): Promise<E2ETestCollection> {
    const id = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const collection: E2ETestCollection = {
      id,
      name: data.name,
      description: data.description,
      testCases: data.testCases,
      createdAt: now,
      updatedAt: now,
    };
    this.collections.set(id, collection);
    await this.save();
    return collection;
  }

  async update(id: string, data: Partial<Pick<E2ETestCollection, 'name' | 'description' | 'testCases'>>): Promise<E2ETestCollection> {
    const existing = this.collections.get(id);
    if (!existing) throw new Error(`E2E Collection ${id} not found`);

    const updated: E2ETestCollection = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.collections.set(id, updated);
    await this.save();
    return updated;
  }

  async remove(id: string): Promise<void> {
    if (!this.collections.has(id)) throw new Error(`E2E Collection ${id} not found`);
    this.collections.delete(id);
    await this.save();
  }
}

export const e2eCollectionStore = new E2ECollectionStore();
