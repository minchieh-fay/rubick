import fs from "fs";
import path from "path";
import type { DeveloperInfo } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");
const DEVELOPER_FILE = path.join(DATA_DIR, "developer.json");

// 确保目录存在
fs.mkdirSync(DATA_DIR, { recursive: true });

/**
 * 获取已保存的开发者信息
 */
export async function getDeveloper(): Promise<DeveloperInfo | null> {
  if (!fs.existsSync(DEVELOPER_FILE)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(DEVELOPER_FILE, "utf-8"));
    return data as DeveloperInfo;
  } catch {
    return null;
  }
}

/**
 * 保存开发者信息
 */
export async function saveDeveloper(info: DeveloperInfo): Promise<void> {
  fs.writeFileSync(DEVELOPER_FILE, JSON.stringify(info, null, 2), "utf-8");
}
