import type { RubickModule } from "../../core/module";

const exampleModule: RubickModule = {
  name: "example",
  async joinHTTP(router: any) {
    console.log("[module:example] joinHTTP");
    router.handle("/example/hello", async () => {
      return { message: "Hello from example module!" };
    });
  },
  async joinMCP(mcp: any) {
    console.log("[module:example] joinMCP");
    mcp.addTool({
      name: "example_tool",
      description: "An example tool",
    });
  },
};

export default exampleModule;

if (import.meta.main) {
  const port = Number(Bun.env.PORT ?? 3100);

  Bun.serve({
    port,
    fetch(request: any) {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return Response.json({
          ok: true,
          module: exampleModule.name,
          mode: "standalone",
        });
      }

      return Response.json({
        message: "example module standalone server",
        module: exampleModule.name,
      });
    },
  });

  console.log(
    `[module:example] standalone mode on http://localhost:${port}/example`,
  );
}
