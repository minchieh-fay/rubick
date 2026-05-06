import fs from "fs";
import path from "path";
import type { AppInfo, AppManifest } from "../types";
import * as hub from "./hub";

const DATA_DIR = path.join(process.cwd(), "data");
const APPS_DIR = path.join(DATA_DIR, "apps");

// 确保目录存在
fs.mkdirSync(APPS_DIR, { recursive: true });

/**
 * 构建 system prompt，包含描述、skill/mcp 依赖和包规范
 */
function buildPrompt(
  description: string,
  workDir: string,
  skills?: string[],
  mcps?: string[]
): string {
  let prompt = `You are building a web app. Create the following files in ${workDir}:

1. index.html - The main HTML file with proper UI structure
2. app.json - A JSON manifest with: name, version (1.0.0), description, author fields

Requirements:
- The app should be self-contained (HTML + CSS + JS inline or relative paths)
- Use clean, modern UI design
- The app description is: "${description}"
`;

  // 添加依赖信息
  if ((skills && skills.length > 0) || (mcps && mcps.length > 0)) {
    prompt += "\nDependencies to include:\n";
    if (skills && skills.length > 0) {
      prompt += `- Skills: ${skills.join(", ")}\n`;
    }
    if (mcps && mcps.length > 0) {
      prompt += `- MCPs: ${mcps.join(", ")}\n`;
    }
    prompt += `\nMake sure the app references these dependencies appropriately.\n`;
  }

  prompt += "\nOnly create these two files. Write the app.json first, then index.html.";
  return prompt;
}

/**
 * 生成唯一的 session 目录
 */
function createSessionDir(): string {
  const timestamp = Date.now();
  const sessionDir = path.join(APPS_DIR, `app-${timestamp}`);
  fs.mkdirSync(sessionDir, { recursive: true });
  return sessionDir;
}

/**
 * 调用 qodercli 生成 app
 */
export async function generateApp(
  prompt: string,
  sessionDir?: string,
  onChunk?: (chunk: string) => void,
  skills?: string[],
  mcps?: string[]
): Promise<{ success: boolean; output: string; sessionDir: string }> {
  const dir = sessionDir || createSessionDir();

  // 构建 system prompt
  const systemPrompt = buildPrompt(prompt, dir, skills, mcps);

  const args = [
    "--model", "ultimate",
    "--dangerously-skip-permissions",
    "-p", systemPrompt,
    "-w", dir,
  ];

  return new Promise((resolve, reject) => {
    const child = Bun.spawn(["qodercli", ...args], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
    });

    let output = "";

    // 5 分钟超时
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("qodercli timed out after 5 minutes"));
    }, 5 * 60 * 1000);

    const readStream = async (
      stream: ReadableStream<Uint8Array>,
      onChunk?: (chunk: string) => void
    ): Promise<string> => {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let result = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          result += text;
          if (onChunk) onChunk(text);
        }
      } finally {
        reader.releaseLock();
      }
      return result;
    };

    Promise.all([
      readStream(child.stdout, onChunk),
      readStream(child.stderr),  // stderr 只收集，不推送给前端
    ]).then(([stdout, stderr]) => {
      output = stdout + stderr;
    }).then(() => child.exited).then((exitCode) => {
      clearTimeout(timeout);
      if (exitCode === 0) {
        resolve({
          success: true,
          output: output || "App generated successfully",
          sessionDir: dir,
        });
      } else {
        resolve({
          success: false,
          output: output || `qodercli exited with code ${exitCode}`,
          sessionDir: dir,
        });
      }
    }).catch((err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * 获取已生成的 app 列表
 */
export function getGeneratedApps(): AppInfo[] {
  if (!fs.existsSync(APPS_DIR)) return [];

  const dirs = fs.readdirSync(APPS_DIR).filter((d) =>
    fs.statSync(path.join(APPS_DIR, d)).isDirectory()
  );

  return dirs
    .map((dirName) => {
      const dirPath = path.join(APPS_DIR, dirName);
      const manifestPath = path.join(dirPath, "app.json");

      if (!fs.existsSync(manifestPath)) return null;

      try {
        const manifest: AppManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        const stat = fs.statSync(dirPath);

        return {
          name: manifest.name || dirName,
          version: manifest.version || "unknown",
          author: manifest.author || "",
          fileName: dirName,
          uploadedAt: "",
          downloads: 0,
          usageCount: 0,
          installed: true,
          createdAt: stat.birthtime.toISOString(),
        } as AppInfo;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as AppInfo[];
}

/**
 * 读取 app manifest
 */
export async function readAppManifest(appName: string): Promise<AppManifest | null> {
  // 先在已生成的 app 中查找
  const apps = getGeneratedApps();
  const app = apps.find((a) => a.name === appName || a.fileName === appName);

  if (app) {
    const manifestPath = path.join(APPS_DIR, app.fileName, "app.json");
    if (fs.existsSync(manifestPath)) {
      return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }
  }

  return null;
}

/**
 * 提供文件服务（用于预览）
 */
export async function serveFile(sessionDir: string, filePath: string, c: any) {
  const fullPath = path.join(APPS_DIR, sessionDir, filePath || "index.html");
  const normalizedPath = path.normalize(fullPath);

  // 防止目录穿越
  if (!normalizedPath.startsWith(APPS_DIR)) {
    return c.text("Forbidden", 403);
  }

  if (!fs.existsSync(normalizedPath)) {
    return c.text("Not Found", 404);
  }

  const ext = path.extname(normalizedPath);
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
  };

  const contentType = mimeTypes[ext] || "application/octet-stream";
  const content = fs.readFileSync(normalizedPath);

  return c.body(content, 200, { "Content-Type": contentType });
}

/**
 * 打包并上传 app
 */
export async function uploadApp(
  appName: string,
  developerName: string,
  developerEmail: string
): Promise<{ success: boolean; fileName?: string }> {
  const apps = getGeneratedApps();
  const app = apps.find((a) => a.name === appName || a.fileName === appName);

  if (!app) {
    throw new Error(`App "${appName}" not found`);
  }

  const appDir = path.join(APPS_DIR, app.fileName);
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  const zipFileName = `app-${appName}-${timestamp}-${app.version}.zip`;
  const zipPath = path.join(DATA_DIR, zipFileName);

  // 打包为 zip（使用 spawn 避免命令注入）
  await new Promise<void>((resolve, reject) => {
    const child = Bun.spawn(["zip", "-r", zipPath, "."], { cwd: appDir });
    child.exited.then((exitCode) => {
      if (exitCode === 0) resolve();
      else reject(new Error(`zip failed with exit code ${exitCode}`));
    }).catch(reject);
  });

  // 读取 zip 文件并上传
  const zipBlob = fs.readFileSync(zipPath);
  const blob = new Blob([zipBlob]);

  // 调用 hub API 上传
  await hub.uploadAppPackage(zipFileName, blob, developerName, developerEmail);

  // 清理临时 zip
  fs.unlinkSync(zipPath);

  return { success: true, fileName: zipFileName };
}
