// @ts-nocheck
import { loadModules } from "./bootstrap/load-modules";

async function bootstrap() {
  const modules = await loadModules();

  for (const moduleDefinition of modules) {
    await moduleDefinition.register?.();
  }

  const port = Number(Bun.env.PORT ?? 3000);

  Bun.serve({
    port,
    fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return Response.json({
          ok: true,
          service: "rubick-server",
          modules: modules.map((item) => item.manifest),
        });
      }

      return Response.json(
        {
          message: "Rubick server is running.",
          loadedModules: modules.map((item) => item.manifest.basePath),
        },
        { status: 200 },
      );
    },
  });

  for (const moduleDefinition of modules) {
    await moduleDefinition.start?.();
  }

  console.log(
    `[server] listening on http://localhost:${port}, loaded ${modules.length} module(s)`,
  );
}

void bootstrap();
