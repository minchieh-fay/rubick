// @ts-nocheck
import type { ServerModule } from "../../core/module";

const exampleModule: ServerModule = {
  manifest: {
    name: "example",
    basePath: "/example",
    description: "示例模块，用来演示独立运行和主工程加载两种模式。",
  },
  register() {
    console.log("[module:example] register");
  },
  start() {
    console.log("[module:example] start");
  },
};

export default exampleModule;

if (import.meta.main) {
  const port = Number(Bun.env.PORT ?? 3100);

  Bun.serve({
    port,
    fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return Response.json({
          ok: true,
          module: exampleModule.manifest.name,
          mode: "standalone",
        });
      }

      return Response.json({
        message: "example module standalone server",
        basePath: exampleModule.manifest.basePath,
      });
    },
  });

  console.log(
    `[module:example] standalone mode on http://localhost:${port}${exampleModule.manifest.basePath}`,
  );
}
