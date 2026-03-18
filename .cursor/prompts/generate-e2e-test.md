# E2E 测试生成 Prompt

## 任务说明

基于提供的小工具代码，生成符合本项目规范的 E2E 自动化测试脚本。

## 项目测试架构

本项目使用自定义的 E2E 测试框架，基于 Playwright，测试脚本以 JSON 格式存储在 `backend/data/e2e-collections.json` 中。

### 测试集合结构

```json
{
  "id": "e2e-[timestamp]-[random]",
  "name": "测试集合名称",
  "description": "测试集合描述",
  "testCases": [
    {
      "id": "e2e-xxx-001",
      "name": "测试用例名称",
      "url": "https://目标页面URL",
      "script": "测试脚本内容（字符串格式，使用\\n换行）",
      "timeout": 120000,
      "tags": ["标签1", "标签2"]
    }
  ],
  "createdAt": "2026-03-17T00:00:00.000Z",
  "updatedAt": "2026-03-17T00:00:00.000Z"
}
```

## 测试脚本编写规范

### 1. 可用的注入变量

测试脚本中可以使用以下预注入的变量：

- `page`: Playwright 的 Page 对象
- `url`: 测试用例的目标 URL
- `assert(condition, message)`: 断言函数
- `__assets`: 测试资源目录路径（用于上传文件）
- `capture(description, options?)`: 增强的截图函数

### 2. capture() 函数使用方法

**基础用法**：

```javascript
await capture("步骤描述");
```

**增强用法（推荐）**：

```javascript
await capture("步骤描述", {
  selector: "元素选择器", // 可选：显示使用的 Playwright 选择器
  status: "success", // 可选：'success' | 'warning' | 'error'
  metadata: {
    // 可选：额外的调试信息
    elementText: "元素文本内容",
    networkRequest: "/api/endpoint",
    consoleMessage: "相关日志信息",
  },
});
```

**capture() 函数会自动收集**：

- ① 步骤编号（自动递增）
- 📍 当前页面 URL
- ⏱️ 步骤耗时
- 📸 页面截图（base64）

### 3. 测试脚本结构模板

```javascript
console.log("🚀 开始测试: [测试名称]");

// 步骤 1: 页面加载
console.log("⏳ 步骤 1/N: 加载页面...");
await page.waitForLoadState("networkidle");
console.log("✓ 页面加载完成");

// 步骤 2: 等待关键元素
console.log("⏳ 步骤 2/N: 等待初始化...");
const element = page.locator("选择器");
await element.waitFor({ state: "visible", timeout: 15000 });
console.log("✓ 初始化完成");

// 步骤 3: 执行操作并截图
console.log("⏳ 步骤 3/N: 执行操作...");
await element.click();
console.log("✓ 操作完成");
await capture("操作后的状态", {
  selector: "选择器",
  metadata: {
    elementText: await element.textContent(),
  },
});

// 步骤 N: 等待结果（支持多种结果）
console.log("⏳ 步骤 N/N: 等待结果...");

const result = await Promise.race([
  page
    .waitForURL((u) => u.href.includes("success-indicator"), { timeout: 90000 })
    .then(() => "success"),
  page
    .locator('[role="dialog"]')
    .waitFor({ state: "visible", timeout: 90000 })
    .then(() => "limit"),
  page
    .getByText(/error|failed/i)
    .waitFor({ state: "visible", timeout: 90000 })
    .then(() => "error"),
]);

if (result === "success") {
  console.log("✅ 成功: 操作成功完成");
  // 可选：等待关键接口
  try {
    await page.waitForResponse(
      (response) =>
        response.url().includes("/api/endpoint") && response.status() === 200,
      { timeout: 30000 },
    );
    console.log("✓ 数据加载完成");
  } catch (err) {
    console.log("⚠️  等待接口超时，直接等待固定时间");
  }
  await page.waitForTimeout(3000);
  await capture("最终结果 - 成功", {
    status: "success",
    metadata: {
      networkRequest: "/api/endpoint",
    },
  });
  assert(page.url().includes("success-indicator"), "应显示成功状态");
} else if (result === "limit") {
  console.log("⚠️  达到限制");
  await capture("最终结果 - 限制提示", {
    selector: '[role="dialog"]',
    status: "warning",
  });
  // 验证限制提示的正确性
} else if (result === "error") {
  console.log("❌ 出现错误");
  const errorText = await page
    .getByText(/error|failed/i)
    .first()
    .textContent();
  await capture("最终结果 - 错误", {
    status: "error",
    metadata: {
      elementText: errorText,
    },
  });
  assert(false, "操作失败: " + errorText);
}
```

## 参考示例：Audio to Text 测试

### 文件上传流程测试

```javascript
console.log("🚀 开始测试: 文件上传流程");

console.log("⏳ 步骤 1/8: 加载页面...");
await page.waitForLoadState("networkidle");
console.log("✓ 页面加载完成");

console.log("⏳ 步骤 2/8: 等待初始化...");
const dragger = page.locator(".ant-upload-drag");
await dragger.waitFor({ state: "visible", timeout: 15000 });
console.log("✓ 上传区域已显示，初始化完成");

console.log("⏳ 步骤 3/8: 上传文件...");
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(__assets + "/test-audio.mp3");
console.log("✓ 文件已选择");

console.log("⏳ 步骤 4/8: 等待文件信息显示...");
const fileNameEl = page.getByText(/test-audio/i);
await fileNameEl.waitFor({ state: "visible", timeout: 10000 });
console.log("✓ 文件名已显示，进入配置步骤");
const fileName = await fileNameEl.textContent();
await capture("文件上传后 - 显示文件信息", {
  selector: "getByText(/test-audio/i)",
  metadata: {
    elementText: fileName,
  },
});

console.log("⏳ 步骤 5/8: 点击处理按钮...");
const processBtn = page.getByRole("button", { name: /transcribe|confirm/i });
await processBtn.click();
console.log("✓ 已点击处理按钮");

console.log("⏳ 步骤 6/8: 等待进度条...");
const progressBar = page.locator('[class*="progress"]').first();
await progressBar.waitFor({ state: "visible", timeout: 10000 });
console.log("✓ 进度条已显示");
await capture("点击处理后 - 显示进度条", {
  selector: '[class*="progress"]',
});

// ... 等待结果
```

## 生成要求

请基于提供的小工具代码，生成完整的 E2E 测试集合 JSON，包括：

### 1. 测试集合信息

- 合适的 ID（格式：`e2e-[timestamp]-[random]`）
- 清晰的名称和描述

### 2. 测试用例设计

- **至少包含 2 个核心流程测试**
- 每个测试用例应该：
  - 有清晰的步骤划分（步骤 1/N, 2/N...）
  - 在关键节点使用 `capture()` 截图（建议 3-5 个截图点）
  - 使用 `console.log` 输出详细的执行日志
  - 支持多种结果场景（成功/限制/错误）
  - 包含适当的断言验证

### 3. 截图策略

在以下关键节点添加截图：

- ✅ 初始状态加载完成后
- ✅ 用户输入/上传完成后
- ✅ 点击主要操作按钮后（显示进度/加载状态）
- ✅ 最终结果页面（成功/失败/限制）

### 4. 选择器建议

- 优先使用语义化选择器：`getByRole()`, `getByText()`, `getByLabel()`
- 避免使用脆弱的 class 选择器
- 使用正则表达式匹配文本以提高健壮性

### 5. 超时设置

- 页面加载：`networkidle` 状态
- 元素等待：15 秒
- 操作结果：根据操作复杂度设置（快速操作 30-90 秒，慢速操作 5-10 分钟）
- 测试总超时：`timeout` 字段设置合理值

### 6. 错误处理

- 使用 `try-catch` 处理可能超时的接口等待
- 为每种结果场景提供清晰的日志输出
- 失败时捕获错误信息并截图

## 输出格式

请输出完整的 JSON 格式测试集合，可以直接添加到 `backend/data/e2e-collections.json` 中。

## 示例输出结构

```json
{
  "id": "e2e-1234567890-abc12",
  "name": "[工具名称] 测试",
  "description": "测试 [工具名称] 的核心功能流程",
  "testCases": [
    {
      "id": "e2e-xxx-001",
      "name": "主要流程测试",
      "url": "https://目标URL",
      "script": "完整的测试脚本（使用\\n换行）",
      "timeout": 120000,
      "tags": ["核心流程"]
    },
    {
      "id": "e2e-xxx-002",
      "name": "备选流程测试",
      "url": "https://目标URL",
      "script": "完整的测试脚本（使用\\n换行）",
      "timeout": 120000,
      "tags": ["核心流程"]
    }
  ],
  "createdAt": "2026-03-17T00:00:00.000Z",
  "updatedAt": "2026-03-17T00:00:00.000Z"
}
```

## 注意事项

1. **脚本格式**：所有测试脚本必须是单个字符串，使用 `\n` 表示换行
2. **JSON 转义**：确保字符串中的特殊字符正确转义（引号、反斜杠等）
3. **资源路径**：如果需要上传文件，使用 `__assets + '/文件名'`
4. **异步操作**：所有 Playwright 操作都需要 `await`
5. **日志输出**：使用 `console.log()` 而不是其他日志方法
6. **截图时机**：在页面状态稳定后再截图，避免捕获过渡动画

---

## 现在请提供你的小工具代码，我将生成对应的 E2E 测试！
