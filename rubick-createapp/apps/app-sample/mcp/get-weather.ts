#!/usr/bin/env bun
/**
 * MCP Server: 天气预报
 * 通过 stdio 与 qodercli 通信
 */

interface McpRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: string;
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

// 工具定义
const TOOLS = [
  {
    name: "get_tomorrow_weather",
    description: "获取明天天气预报。返回天气状况、温度、湿度、紫外线指数、风力等信息。无需参数。",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_wind_detail",
    description: "获取风力详细信息。当天气预报提到有风时调用，返回风力等级、风向、阵风等信息。无需参数。",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// 模拟天气数据（实际项目可替换为真实 API）
const WEATHER_DATA = {
  weather: "晴天",
  temperature: 33,
  humidity: 60,
  uvIndex: "强",
  windLevel: 2,
  windDirection: "东南风",
  windDesc: "微风",
};

const WIND_DETAIL = {
  windLevel: 2,
  windLevelDesc: "轻风",
  windSpeed: "6-11 km/h",
  windDirection: "东南风",
  gustSpeed: "15 km/h",
  impact: "树叶微动，体感舒适",
};

function handleRequest(req: McpRequest): McpResponse | null {
  const { method, params, id } = req;

  // initialize
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "weather-mcp", version: "1.0.0" },
      },
    };
  }

  // initialized notification (no response needed)
  if (method === "notifications/initialized") {
    return null;
  }

  // tools/list
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  // tools/call
  if (method === "tools/call") {
    const name = (params as any)?.name;
    if (name === "get_tomorrow_weather") {
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(WEATHER_DATA) }] } };
    }
    if (name === "get_wind_detail") {
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(WIND_DETAIL) }] } };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } };
  }

  // ping
  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } };
}

// 读取 stdin 行
const lines: Buffer[] = [];
process.stdin.on("data", (chunk: Buffer) => {
  lines.push(chunk);
  const full = Buffer.concat(lines);
  const text = full.toString("utf-8");
  const newlineIdx = text.indexOf("\n");
  if (newlineIdx === -1) return;

  lines.length = 0;
  if (newlineIdx < text.length - 1) {
    lines.push(Buffer.from(text.slice(newlineIdx + 1)));
  }

  const line = text.slice(0, newlineIdx);
  if (!line.trim()) return;

  try {
    const req: McpRequest = JSON.parse(line);
    const resp = handleRequest(req);
    if (resp) {
      process.stdout.write(JSON.stringify(resp) + "\n");
    }
  } catch (e: any) {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: "err", error: { code: -32700, message: e.message } }) + "\n");
  }
});

// 保持进程运行
process.stdin.resume();
