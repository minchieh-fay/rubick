// App 包信息（从 hub 获取或本地已生成）
export interface AppInfo {
  name: string;           // descriptive-name
  version: string;
  author: string;
  email?: string;
  fileName: string;       // 完整包文件名
  uploadedAt: string;
  downloads: number;
  usageCount: number;
  installed?: boolean;    // 本地是否已存在
  createdAt?: string;     // 本地创建时间
}

// app.json 内容（app 元信息）
export interface AppManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  email?: string;
  dependencies?: {
    skills?: string[];
    mcps?: string[];
  };
  fields?: FormField[];   // 结构化表单字段定义
}

// 表单字段定义
export interface FormField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];  // select 类型用
}

// 生成任务
export interface GenerateTask {
  id: string;
  prompt: string;
  status: "pending" | "running" | "completed" | "error";
  sessionDir?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

// Chat 消息
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

// Hub API 返回的客户端更新信息
export interface ClientUpdate {
  name: string;
  version: string;
  fileName: string;
  platform: string;
  downloadUrl: string;
}

// 开发者信息
export interface DeveloperInfo {
  name: string;
  email: string;
}
