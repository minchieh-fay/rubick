import { join } from "path";
import { readdirSync, existsSync } from "fs";

const DATA_DIR = join(process.cwd(), "data");

// 确保目录存在
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    Bun.write(dir, "", { createPath: true });
  }
}

// 安装 app：下载 zip 并解压到 data/apps/{descriptive-name}/
export async function installApp(fileName: string, blob: Blob): Promise<string> {
  // 从文件名解析 descriptive-name
  // 格式：app-{descriptive-name}-{YYYYMMDDHHmmss}-{version}.zip
  const match = fileName.match(/^app-(.+)-\d{14}-(.+)\.zip$/);
  if (!match) {
    throw new Error(`Invalid app filename: ${fileName}`);
  }
  const descriptiveName = match[1];
  const appDir = join(DATA_DIR, "apps", descriptiveName);

  ensureDir(appDir);

  // 写入 zip 文件
  const zipPath = join(appDir, fileName);
  const zipFile = Bun.file(zipPath);
  await Bun.write(zipFile, blob);

  // 解压 zip
  await Bun.spawn(["unzip", "-o", zipPath, "-d", appDir]).exited;

  // 删除 zip 文件
  await Bun.file(zipPath).delete();

  return appDir;
}

// 读取 app.json
export async function readAppManifest(appName: string) {
  const manifestPath = join(DATA_DIR, "apps", appName, "app.json");
  const file = Bun.file(manifestPath);
  if (!await file.exists()) {
    return null;
  }
  return JSON.parse(await file.text());
}

// 读取 prompt.md
export async function readAppPrompt(appName: string): Promise<string> {
  const promptPath = join(DATA_DIR, "apps", appName, "prompt.md");
  const file = Bun.file(promptPath);
  if (!await file.exists()) {
    return "";
  }
  return file.text();
}

// 检查 app 是否已安装
export function isAppInstalled(appName: string): boolean {
  const appDir = join(DATA_DIR, "apps", appName);
  return existsSync(appDir);
}

// 获取已安装的 app 列表
export function getInstalledApps(): string[] {
  const appsDir = join(DATA_DIR, "apps");
  if (!existsSync(appsDir)) {
    return [];
  }
  return readdirSync(appsDir);
}
