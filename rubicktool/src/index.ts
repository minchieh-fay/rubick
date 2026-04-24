import { createWindow } from "./routes/index";

/**
 * rubicktool - 可视化 App 生成工具
 * 
 * 启动入口
 */
async function main() {
  const app = await createWindow();
  return app;
}

main();
