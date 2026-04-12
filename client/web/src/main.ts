const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <main style="font-family: sans-serif; padding: 24px;">
      <h1>Rubick Client</h1>
      <p>这里是默认的 B/S 客户端页面。</p>
      <p>页面后续可以同时调用本地 localhost API 和远端服务端 API。</p>
    </main>
  `;
}
