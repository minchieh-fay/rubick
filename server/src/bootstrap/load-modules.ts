import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { RubickModule } from "../core/module";

/**
 * 递归加载模块目录下的所有子目录
 * @param basePath 基础路径 (如 core/providers 或 modules)
 * @returns 加载成功的模块列表
 */
async function loadFromDir(basePath: string): Promise<RubickModule[]> {
  const absolutePath = join(import.meta.dir, "..", basePath);
  if (!existsSync(absolutePath)) {
    return [];
  }

  const dirEntries = readdirSync(absolutePath, { withFileTypes: true });
  const modules: RubickModule[] = [];

  for (const dirEntry of dirEntries) {
    if (!dirEntry.isDirectory()) {
      continue;
    }

    const entryFile = join(absolutePath, dirEntry.name, "index.ts");

    if (!existsSync(entryFile)) {
      continue;
    }

    try {
      const imported = await import(pathToFileURL(entryFile).href);
      const moduleDefinition = imported.default as RubickModule | undefined;

      if (moduleDefinition && moduleDefinition.joinHTTP && moduleDefinition.joinMCP) {
        modules.push(moduleDefinition);
      }
    } catch (error) {
      console.error(`[loadModules] Error loading module ${dirEntry.name}:`, error);
    }
  }

  return modules;
}

export async function loadModules(): Promise<RubickModule[]> {
  const [coreModules, bizModules] = await Promise.all([
    loadFromDir("core"),
    loadFromDir("modules")
  ]);

  return [...coreModules, ...bizModules];
}
