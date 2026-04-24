import path from "path";

/**
 * 创建主窗口
 * 调试阶段使用浏览器 BS 结构，构建阶段走 electrobun 打包
 */
export async function createWindow() {
  const { app, BrowserWindow } = await import("electrobun");

  await app.whenReady();

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 加载 public/index.html
  const htmlPath = path.join(__dirname, "../public/index.html");
  mainWindow.loadFile(htmlPath);

  // 开发模式打开 DevTools
  mainWindow.webContents.openDevTools();

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  return mainWindow;
}
