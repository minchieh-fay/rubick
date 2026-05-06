import type { AppInfo, ClientUpdate } from "../types";

const HUB_BASE_URL = process.env.HUB_BASE_URL || "http://localhost:3000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HUB_BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Hub API ${res.status}: ${body.error || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// 获取 app 列表
export async function fetchApps(sort = "usageCount"): Promise<AppInfo[]> {
  return request(`/api/apps?sort=${sort}`);
}

// 获取 skills 列表
export async function fetchSkills(sort = "usageCount"): Promise<AppInfo[]> {
  return request(`/api/skills?sort=${sort}`);
}

// 获取 mcps 列表
export async function fetchMcps(sort = "usageCount"): Promise<AppInfo[]> {
  return request(`/api/mcps?sort=${sort}`);
}

// 下载包（返回 blob）
export async function downloadPackage(fileName: string): Promise<Blob> {
  const res = await fetch(`${HUB_BASE_URL}/api/apps/download/${fileName}`);
  if (!res.ok) {
    throw new Error(`Failed to download ${fileName}`);
  }
  return res.blob();
}

// 上传 app 包
export async function uploadAppPackage(
  fileName: string,
  blob: Blob,
  author: string,
  email?: string
): Promise<{ success: boolean }> {
  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("author", author);
  if (email) formData.append("email", email);

  return request("/api/apps/upload", {
    method: "POST",
    body: formData,
  });
}

// 查询 rubick 自身更新
export async function checkRubickUpdate(): Promise<ClientUpdate> {
  return request("/api/clients/latest?name=rubick");
}
