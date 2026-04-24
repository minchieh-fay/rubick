import { handleRoutes } from "./routes";
import { ensureDataDirs } from "./services/data";

const PORT = parseInt(process.env.PORT || "3000");

// Initialize data directories
ensureDataDirs();

console.log(`rubickhub starting on port ${PORT}`);

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    try {
      const response = handleRoutes(req);
      if (response) {
        return response;
      }
      return new Response("Not found", { status: 404 });
    } catch (err: any) {
      console.error("Error:", err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});

console.log(`Listening on http://localhost:${server.port}`);
