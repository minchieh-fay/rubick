// App 包信息（从 hub 获取或本地已安装）
export interface AppInfo {
  name: string;           // descriptive-name
  version: string;
  author: string;
  email?: string;
  fileName: string;       // 完整包文件名
  uploadedAt: string;
  downloads: number;
  usageCount: number;
  installed?: boolean;    // 本地是否已安装
  installedAt?: string;   // 本地安装时间
}

// app.json 内容（解压后的 app 元信息）
export interface AppManifest {
  name: string;
  version: string;
  description?: string;
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

// Session 状态
export interface Session {
  id: string;             // 时间戳作为唯一标识
  appName: string;        // 所属 app
  status: "idle" | "running" | "completed" | "error";
  formData: Record<string, string>;  // 结构化表单数据
  chatMessages: ChatMessage[];       // chat 区消息
  result?: string;        // 执行结果
  errorMessage?: string;  // 错误信息
  createdAt: string;
  startedAt?: string;
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
