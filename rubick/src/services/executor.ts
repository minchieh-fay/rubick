import { spawn } from "child_process";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { readAppManifest, readAppPrompt } from "./app_help";
import type { Session } from "../types";

const DATA_DIR = join(process.cwd(), "data");

// 回调类型：流式输出片段
export type OutputCallback = (chunk: string) => void;

// 执行 session：创建目录、复制 skill、生成 .mcp.json、调用 qodercli
export async function executeSession(session: Session, onOutput?: OutputCallback): Promise<{ success: boolean; output: string; error?: string }> {
  const workDir = join(DATA_DIR, "apps", session.appName, "sessions", session.id);

  // 确保工作目录存在
  if (!existsSync(workDir)) {
    mkdirSync(workDir, { recursive: true });
  }

  // 读取 app 的 prompt.md
  const basePrompt = await readAppPrompt(session.appName);

  // 读取 app.json 获取依赖
  const manifest = await readAppManifest(session.appName);

  // 复制依赖的 skills
  if (manifest?.dependencies?.skills) {
    const skillsDir = join(workDir, ".qoder", "skills");
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
    }
    for (const skillName of manifest.dependencies.skills) {
      const skillSource = join(DATA_DIR, "skills", skillName);
      const skillTarget = join(skillsDir, skillName);
      if (existsSync(skillSource)) {
        await Bun.spawn(["cp", "-r", skillSource, skillTarget]).exited;
      }
    }
  }

  // 生成 .mcp.json
  if (manifest?.dependencies?.mcps) {
    const mcpConfig: Record<string, { command: string; args: string[] }> = {};
    for (const mcpName of manifest.dependencies.mcps) {
      const mcpDir = join(DATA_DIR, "mcps", mcpName);
      if (existsSync(mcpDir)) {
        mcpConfig[mcpName] = {
          command: "bun",
          args: [join(mcpDir, "index.ts")],
        };
      }
    }
    if (Object.keys(mcpConfig).length > 0) {
      const mcpPath = join(workDir, ".mcp.json");
      Bun.write(mcpPath, JSON.stringify({ mcpServers: mcpConfig }, null, 2));
    }
  }

  // 构建提示词：prompt.md + 表单数据 + chat 消息
  const prompt = buildPrompt(basePrompt, session);

  // 调用 qodercli
  return runQodercli(workDir, prompt, onOutput);
}

function buildPrompt(basePrompt: string, session: Session): string {
  let prompt = basePrompt;

  // 添加表单数据
  if (Object.keys(session.formData).length > 0) {
    prompt += "\n\n## 用户输入的表单数据：\n";
    for (const [key, value] of Object.entries(session.formData)) {
      prompt += `- ${key}: ${value}\n`;
    }
  }

  // 添加 chat 消息
  if (session.chatMessages.length > 0) {
    prompt += "\n\n## 用户的补充说明：\n";
    for (const msg of session.chatMessages) {
      if (msg.role === "user") {
        prompt += `${msg.content}\n`;
      }
    }
  }

  return prompt;
}

function runQodercli(
  workDir: string,
  prompt: string,
  onOutput?: OutputCallback,
): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("qodercli", [
      "--model", "ultimate",
      "--dangerously-skip-permissions",
      "-w", workDir,
      "-p", prompt,
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      onOutput?.(chunk);
    });

    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      onOutput?.(chunk);
    });

    child.on("close", (code) => {
      resolve({
        success: code === 0,
        output: stdout,
        error: code !== 0 ? stderr : undefined,
      });
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}
