// @ts-nocheck
const port = Number(Bun.env.PORT ?? 3789);

Bun.serve({
  port,
  hostname: "127.0.0.1",
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "rubick-client-server",
      });
    }

    if (url.pathname === "/api/config") {
      return Response.json({
        serverBaseUrl: "http://127.0.0.1:3000",
        note: "后续这里可以返回当前客户端所连接的服务端配置。",
      });
    }

    return Response.json({
      message: "Rubick client server is running.",
    });
  },
});

console.log(`[client-server] listening on http://127.0.0.1:${port}`);
