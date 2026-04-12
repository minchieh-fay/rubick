// @ts-nocheck
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { ServerModule } from "../core/module";

export async function loadModules(): Promise<ServerModule[]> {
  const modulesDir = join(import.meta.dir, "..", "modules");
  const dirEntries = readdirSync(modulesDir, { withFileTypes: true });
  const modules: ServerModule[] = [];

  for (const dirEntry of dirEntries) {
    if (!dirEntry.isDirectory()) {
      continue;
    }

    const entryFile = join(modulesDir, dirEntry.name, "index.ts");

    if (!existsSync(entryFile)) {
      continue;
    }

    const imported = await import(pathToFileURL(entryFile).href);
    const moduleDefinition = imported.default as ServerModule | undefined;

    if (moduleDefinition) {
      modules.push(moduleDefinition);
    }
  }

  return modules;
}
