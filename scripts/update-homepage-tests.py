#!/usr/bin/env python3
"""
更新首页登录注册按钮链接验证 collection。
后端启动后运行: python3 scripts/update-homepage-tests.py
"""
import json, subprocess, sys

COLLECTION_ID = "e2e-1775126732398-uhkvl"
API_BASE = "http://localhost:4001/api/tools/e2e-tester"

HIGHLIGHT_FN = """\
async function highlight(link) {
  try {
    await link.evaluate(node => {
      node.style.outline = '3px solid red';
      node.style.outlineOffset = '2px';
    });
  } catch {}
}
async function unhighlight(link) {
  try {
    await link.evaluate(node => {
      node.style.outline = '';
      node.style.outlineOffset = '';
    });
  } catch {}
}
"""

en_script = HIGHLIGHT_FN + """\
console.log('🚀 开始测试: 英文首页按钮链接验证');
await page.waitForLoadState('networkidle');
console.log('✓ 页面加载完成');

const EXPECTED = [
  { text: /^Log in$/,            href: 'https://app.notta.ai/login?language=en&from=official' },
  { text: /^Start for Free$/,    href: 'https://app.notta.ai/signup?language=en&from=official' },
  { text: /🔥.*Start for Free/,  href: 'https://app.notta.ai/signup?language=en&from=official' },
  { text: /Start Free Trial/,    href: 'https://app.notta.ai/signup?language=en&from=official' },
];

const allLinks = page.locator('a[href*="app.notta.ai"]');
const count = await allLinks.count();
console.log('找到 app.notta.ai 链接总数:', count);
assert(count > 0, '页面应存在 app.notta.ai 链接');

const failures = [];
for (let i = 0; i < count; i++) {
  const link = allLinks.nth(i);
  const href = await link.getAttribute('href');
  const text = (await link.textContent()).trim().replace(/\\s+/g, ' ');

  const rule = EXPECTED.find(r => r.text.test(text));
  const ok   = rule && href === rule.href;
  const status = !rule ? 'warning' : ok ? 'success' : 'error';

  const visible = await link.isVisible();
  if (visible) {
    await link.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await highlight(link);
  }

  await capture(
    '[' + (i + 1) + '/' + count + '] ' + text.substring(0, 30) + (ok ? ' ✓' : ' ✗'),
    { status, metadata: { elementText: text + ' → ' + href } }
  );

  if (visible) await unhighlight(link);

  console.log('[' + (i+1) + '] text=' + JSON.stringify(text) + '  href=' + href + '  ' + status);

  if (!rule) {
    failures.push({ text, href, reason: '未知按钮' });
  } else if (!ok) {
    failures.push({ text, href, expected: rule.href });
  }
}

if (failures.length > 0) {
  console.log('❌ 失败:', JSON.stringify(failures));
  assert(false, failures.length + ' 个按钮链接不正确：' + JSON.stringify(failures));
}
console.log('✅ 英文首页按钮链接验证完成 (' + count + ' 个按钮)');
"""

ja_script = HIGHLIGHT_FN + """\
console.log('🚀 开始测试: 日文首页按钮链接验证');
await page.waitForLoadState('networkidle');
console.log('✓ 页面加载完成，当前 URL:', page.url());

const S_JP = 'https://app.notta.ai/signup?language=jp&from=official';
const S_JA = 'https://app.notta.ai/signup?language=ja&from=official';
const L_JP = 'https://app.notta.ai/login?language=jp&from=official';
const L_JA = 'https://app.notta.ai/login?language=ja&from=official';

const EXPECTED = [
  { text: /^ログイン$/,       hrefs: [L_JP, L_JA] },
  { text: /^新規登録$/,       hrefs: [S_JP, S_JA] },
  { text: /Nottaをはじめる/,  hrefs: [S_JP, S_JA] },
  { text: /Start for Free/,  hrefs: [S_JP, S_JA] },
  { text: /無料/,             hrefs: [S_JP, S_JA] },
];

const allLinks = page.locator('a[href*="app.notta.ai"]');
const count = await allLinks.count();
console.log('找到 app.notta.ai 链接总数:', count);
assert(count > 0, '页面应存在 app.notta.ai 链接');

const failures = [];
for (let i = 0; i < count; i++) {
  const link = allLinks.nth(i);
  const href = await link.getAttribute('href');
  const text = (await link.textContent()).trim().replace(/\\s+/g, ' ');

  const rule = EXPECTED.find(r => r.text.test(text));
  const ok   = rule && rule.hrefs.includes(href);
  const status = !rule ? 'warning' : ok ? 'success' : 'error';

  const visible = await link.isVisible();
  if (visible) {
    await link.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await highlight(link);
  }

  await capture(
    '[' + (i + 1) + '/' + count + '] ' + text.substring(0, 30) + (ok ? ' ✓' : ' ✗'),
    { status, metadata: { elementText: text + ' → ' + href } }
  );

  if (visible) await unhighlight(link);

  console.log('[' + (i+1) + '] text=' + JSON.stringify(text) + '  href=' + href + '  ' + status);

  if (!rule) {
    failures.push({ text, href, reason: '未知按钮' });
  } else if (!ok) {
    failures.push({ text, href, expected: rule.hrefs });
  }
}

if (failures.length > 0) {
  console.log('❌ 失败:', JSON.stringify(failures));
  assert(false, failures.length + ' 个按钮链接不正确：' + JSON.stringify(failures));
}
console.log('✅ 日文首页按钮链接验证完成 (' + count + ' 个按钮)');
"""

payload = {
    "testCases": [
        {
            "id": "e2e-hp-en-001",
            "name": "英文首页 - 登录注册按钮链接验证",
            "url": "https://www.notta.ai/en",
            "script": en_script,
            "timeout": 60000,
            "tags": ["按钮链接", "英文", "登录", "注册"]
        },
        {
            "id": "e2e-hp-ja-001",
            "name": "日文首页 - 登录注册按钮链接验证",
            "url": "https://www.notta.ai/",
            "locale": "ja-JP",
            "script": ja_script,
            "timeout": 60000,
            "tags": ["按钮链接", "日文", "登录", "注册"]
        }
    ]
}

result = subprocess.run(
    ["curl", "-s", "-X", "PUT",
     f"{API_BASE}/collections/{COLLECTION_ID}",
     "-H", "Content-Type: application/json",
     "-d", json.dumps(payload)],
    capture_output=True, text=True
)

if not result.stdout.strip():
    print("❌ 后端无响应，请先启动服务 (pnpm run dev)", file=sys.stderr)
    sys.exit(1)

resp = json.loads(result.stdout)
if "error" in resp:
    print("❌ API 错误:", resp["error"], file=sys.stderr)
    sys.exit(1)

print("✅ 更新成功:", resp["name"])
for t in resp["testCases"]:
    print(f"  [{t['id']}] {t['name']}  timeout={t['timeout']}ms  locale={t.get('locale', '-')}")
