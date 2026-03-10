import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UrlTestCase } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../data');
const COLLECTIONS_FILE = path.join(DATA_DIR, 'collections.json');

export interface TestCollection {
  id: string;
  name: string;
  description?: string;
  testCases: UrlTestCase[];
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_SEED: TestCollection[] = [
  {
    id: 'redirect-tests',
    name: '重定向测试',
    description: 'CloudFront / Lambda@Edge 重定向规则批量测试',
    testCases: [
      { id: 'vr-1', name: '日本用户访问首页 — 不重定向', description: '日语用户直接返回首页内容（HTTP 200），不发生语言重定向', url: 'https://www.notta.ai/', expectedStatus: 200, country: 'JP' },
      { id: 'vr-2', name: '美国用户访问首页 — 302 到 /en/', description: '美国 IP 访问首页应 302 重定向到 /en/', url: 'https://www.notta.ai/', expectedStatus: 302, expectedRedirectUrl: 'https://www.notta.ai/en/', country: 'US' },
      { id: 'vr-3', name: 'Cookie 语言优先于国家 — 302 到 /es/', description: '设置 selected-lang=es cookie 后应重定向到 /es/', url: 'https://www.notta.ai/', cookies: { 'selected-lang': 'es' }, expectedStatus: 302, expectedRedirectUrl: 'https://www.notta.ai/es/' },
      { id: 'vr-4', name: 'Googlebot 访问首页 — 不重定向', description: 'Googlebot UA 直接返回首页内容（HTTP 200）', url: 'https://www.notta.ai/', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }, expectedStatus: 200 },
      { id: 'vr-12', name: '不支持的语言国家 — fallback 到 /en/', description: '俄语 Accept-Language 不在支持列表中，回退到 /en/', url: 'https://www.notta.ai/', headers: { 'Accept-Language': 'ru' }, expectedStatus: 302, expectedRedirectUrl: 'https://www.notta.ai/en/', country: 'US' },
      { id: 'or-5', name: 'help.notta.ai 域名重定向', description: 'help.notta.ai 应 301 重定向到 support.notta.ai', url: 'https://help.notta.ai/some-article', expectedStatus: 301, expectedRedirectUrl: 'https://support.notta.ai/hc/en-us', notes: '需要 DNS 解析到同一个 CloudFront 分配' },
      { id: 'or-7', name: '精确路径重定向', description: '/en/audio-to-text 应 301 重定向到 /en/tools/audio-to-text-converter', url: 'https://www.notta.ai/en/audio-to-text', expectedStatus: 301, expectedRedirectUrl: 'https://www.notta.ai/en/tools/audio-to-text-converter' },
      { id: 'or-8', name: '外部链接重定向', description: '/request 应 301 重定向到 support.notta.ai 的文章', url: 'https://www.notta.ai/request', expectedStatus: 301, expectedRedirectUrl: 'https://support.notta.ai/hc/ja/articles/4402669737499' },
      { id: 'or-9', name: '前缀匹配重定向', description: '/article/some-blog-post 应 301 重定向到 /en/blog/some-blog-post', url: 'https://www.notta.ai/article/some-blog-post', expectedStatus: 301, expectedRedirectUrl: 'https://www.notta.ai/en/blog/some-blog-post' },
      { id: 'or-10', name: '普通页面（无重定向）', description: '/en/pricing 应正常返回 200', url: 'https://www.notta.ai/en/pricing', expectedStatus: 200 },
      { id: 'or-11', name: 'Trailing slash 处理', description: '/en/pricing/ 的 trailing slash 被去掉，正常返回页面', url: 'https://www.notta.ai/en/pricing/', expectedStatus: 200 },
      { id: 'ex-1', name: '多语言重定向 — 西班牙语', description: '/es/audio-a-texto 应 301 重定向到 /es/audio-to-text', url: 'https://www.notta.ai/es/audio-a-texto', expectedStatus: 301, expectedRedirectUrl: 'https://www.notta.ai/es/audio-to-text' },
      { id: 'ex-2', name: '多语言重定向 — 德语', description: '/de/audio-transkribieren 应 301 重定向到 /de/audio-to-text', url: 'https://www.notta.ai/de/audio-transkribieren', expectedStatus: 301, expectedRedirectUrl: 'https://www.notta.ai/de/audio-to-text' },
      { id: 'ex-3', name: 'notta-brain 重定向', description: '/notta-brain 应 301 重定向到 /brain', url: 'https://www.notta.ai/notta-brain', expectedStatus: 301, expectedRedirectUrl: 'https://www.notta.ai/brain' },
      { id: 'ex-4', name: 'youtube-to-text 重定向', description: '/en/youtube-to-text 应 301 重定向到 /en/tools/youtube-transcript-generator', url: 'https://www.notta.ai/en/youtube-to-text', expectedStatus: 301, expectedRedirectUrl: 'https://www.notta.ai/en/tools/youtube-transcript-generator' },
      { id: 'ex-5', name: 'changelog 重定向', description: '/changelog 应 301 重定向到 /hub/changelog', url: 'https://www.notta.ai/changelog', expectedStatus: 301, expectedRedirectUrl: 'https://www.notta.ai/hub/changelog' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

class CollectionStore {
  private collections: Map<string, TestCollection> = new Map();
  private initialized = false;

  async init() {
    if (this.initialized) return;
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
      const data = await fs.readFile(COLLECTIONS_FILE, 'utf-8');
      const items = JSON.parse(data) as TestCollection[];
      for (const c of items) {
        this.collections.set(c.id, c);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        for (const c of DEFAULT_SEED) {
          this.collections.set(c.id, c);
        }
        await this.save();
      } else {
        console.error('Failed to load collections:', error);
      }
    }

    this.initialized = true;
  }

  private async save() {
    const items = Array.from(this.collections.values());
    await fs.writeFile(COLLECTIONS_FILE, JSON.stringify(items, null, 2), 'utf-8');
  }

  getAll(): TestCollection[] {
    return Array.from(this.collections.values());
  }

  getById(id: string): TestCollection | undefined {
    return this.collections.get(id);
  }

  async create(data: { name: string; description?: string; testCases: UrlTestCase[] }): Promise<TestCollection> {
    const id = `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const collection: TestCollection = {
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

  async update(id: string, data: Partial<Pick<TestCollection, 'name' | 'description' | 'testCases'>>): Promise<TestCollection> {
    const existing = this.collections.get(id);
    if (!existing) throw new Error(`Collection ${id} not found`);

    const updated: TestCollection = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.collections.set(id, updated);
    await this.save();
    return updated;
  }

  async remove(id: string): Promise<void> {
    if (!this.collections.has(id)) throw new Error(`Collection ${id} not found`);
    this.collections.delete(id);
    await this.save();
  }
}

export const collectionStore = new CollectionStore();
