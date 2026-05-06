import type { Hono } from "hono";

/**
 * 示例后端：前端可直接调用
 * 路由自动挂载到 /api/backend/*
 */
export default function registerRoutes(app: Hono) {
  // GET /api/backend/weather/tomorrow
  app.get("/weather/tomorrow", (c) => {
    return c.json({
      date: "明天",
      weather: "晴天",
      temperature: 33,
      humidity: 60,
      uvIndex: "强",
    });
  });
}
