import http from 'node:http';
import type { GeoCountry } from './types.js';

const MIHOMO_SOCKET = '/tmp/biuuu.sock';
const PROXY_GROUPS = ['GLOBAL', 'Biuuu'];

const COUNTRY_KEYWORDS: Record<GeoCountry, string> = {
  JP: '日本',
  US: '美国',
  SG: '新加坡',
  HK: '香港',
  TW: '台湾',
  DE: '德国',
  FR: '法国',
  GB: '英国',
  KR: '韩国',
  IN: '印度',
  BR: '巴西',
  AU: '澳洲',
  CA: '加拿大',
};

function mihomoRequest(method: string, path: string, body?: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      socketPath: MIHOMO_SOCKET,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

interface ProxyGroupInfo {
  now: string;
  all: string[];
}

async function getProxyGroup(group: string): Promise<ProxyGroupInfo> {
  const data = await mihomoRequest('GET', `/proxies/${encodeURIComponent(group)}`);
  return JSON.parse(data);
}

async function setProxyNode(group: string, nodeName: string): Promise<void> {
  await mihomoRequest('PUT', `/proxies/${encodeURIComponent(group)}`, { name: nodeName });
}

export async function getCurrentNode(): Promise<string> {
  try {
    const info = await getProxyGroup(PROXY_GROUPS[0]);
    return info.now;
  } catch {
    return '';
  }
}

export async function findNodeForCountry(country: GeoCountry): Promise<string | null> {
  const keyword = COUNTRY_KEYWORDS[country];
  if (!keyword) return null;

  try {
    const info = await getProxyGroup(PROXY_GROUPS[0]);
    const candidates = info.all.filter((name) => name.includes(keyword));
    return candidates.length > 0 ? candidates[0] : null;
  } catch {
    return null;
  }
}

export async function switchToCountry(country: GeoCountry): Promise<string | null> {
  const nodeName = await findNodeForCountry(country);
  if (!nodeName) return null;

  for (const group of PROXY_GROUPS) {
    try {
      await setProxyNode(group, nodeName);
    } catch {
      // group might not exist, ignore
    }
  }

  await new Promise((r) => setTimeout(r, 500));
  return nodeName;
}

export async function switchToNode(nodeName: string): Promise<void> {
  for (const group of PROXY_GROUPS) {
    try {
      await setProxyNode(group, nodeName);
    } catch {
      // ignore
    }
  }
  await new Promise((r) => setTimeout(r, 500));
}

export async function isAvailable(): Promise<boolean> {
  try {
    await mihomoRequest('GET', '/proxies');
    return true;
  } catch {
    return false;
  }
}
