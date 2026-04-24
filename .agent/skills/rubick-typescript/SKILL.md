---
name: rubick-typescript
description: Rubick 项目 TypeScript 编码规范。所有工程必须遵守，确保代码可读性和一致性。
---

# Rubick TypeScript 编码规范

## 基本原则

- **可读性优先** — 代码是给人读的，不是给机器执行的
- **单一职责** — 每个函数/模块只做一件事
- **辅助函数外置** — 工具函数抽到 `*_help.ts` 文件中

## 命名规范

### 文件命名

- 模块/服务：`kebab-case.ts`（如 `data-service.ts`）
- 类型定义：`types.ts`
- 辅助函数：`{module}_help.ts`（如 `app_help.ts`）
- 入口文件：`index.ts`

### 变量和函数

```typescript
// 变量：camelCase
const userName = "test";
const packageList = [];

// 常量：UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const DATA_DIR = "/path/to/data";

// 函数：camelCase，动词开头
function listPackages() {}
function createSession() {}
function isValidVersion() {}

// 布尔值：is/has/should 前缀
const isActive = true;
const hasPermission = false;
const shouldUpdate = true;
```

### 类型和接口

```typescript
// 接口：PascalCase
interface PackageMeta {}
interface AppConfig {}

// 类型别名：PascalCase
type PackageType = "app" | "skill" | "mcp";
type SortOrder = "asc" | "desc";
```

## 代码组织

### 文件内顺序

```
1. imports
2. 类型定义
3. 常量
4. 主函数/类
5. 辅助函数（私有）
```

### 导入顺序

```typescript
// 1. 标准库/第三方
import { readFileSync } from "fs";
import { join } from "path";

// 2. 内部模块（相对路径，按层级）
import { PackageMeta } from "../types";
import { listPackages } from "../services/data";
```

## TypeScript 规范

### 类型声明

- 函数参数和返回值必须有类型
- 不要用 `any`，用 `unknown` 或具体类型
- 接口优先于 type（除非是联合类型）

```typescript
// Good
function findPackage(type: PackageType, name: string): PackageMeta | undefined {}

// Bad
function findPackage(type: any, name: string): any {}
```

### 错误处理

```typescript
// 用 try-catch 包裹外部调用
try {
  const result = await externalCall();
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("Error:", message);
}
```

### 不要做的

- 不要用 `require()`，全部 `import`
- 不要混用 CommonJS 和 ESM
- 不要用 `var`，用 `const`/`let`
- 不要用 `==`，用 `===`
- 不要写超过 3 层的嵌套 if/for
- 不要在一个文件里写超过 200 行代码（拆文件）
