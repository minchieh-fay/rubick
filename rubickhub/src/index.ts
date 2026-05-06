import { handleRoutes } from "./routes";
import { ensureDataDirs } from "./services/data";
import { logger } from "./services/logger";

const PORT = parseInt(process.env.PORT || "3000");

// CORS headers for preflight
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE, PUT",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Initialize data directories
ensureDataDirs();

logger.info(`rubickhub starting on port ${PORT}`);

const server = Bun.serve({
  port: PORT,
  maxRequestBodySize: 1024 * 1024 * 50,
  async fetch(req: Request) {
    try {
      if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
      }

      const response = handleRoutes(req);
      if (response) return response;

      logger.warn("404 Not found", { method: req.method, path: new URL(req.url).pathname });
      return new Response(JSON.stringify({ error: "Not found", path: new URL(req.url).pathname }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    } catch (err: any) {
      logger.error("Unhandled error", { error: err.message, stack: err.stack });
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  },
});

logger.info(`Listening on http://localhost:${server.port}`);
