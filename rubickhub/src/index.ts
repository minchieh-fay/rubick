import { handleRoutes } from "./routes";
import { ensureDataDirs } from "./services/data";
import { logger } from "./services/logger";

const PORT = parseInt(process.env.PORT || "3000");

// CORS headers for cross-project calls
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// Initialize data directories
ensureDataDirs();

logger.info(`rubickhub starting on port ${PORT}`);

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    try {
      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
      }

      const response = handleRoutes(req);
      if (response) {
        // Add CORS headers to all responses
        const newHeaders = new Headers(response.headers);
        for (const [key, value] of Object.entries(CORS_HEADERS)) {
          newHeaders.set(key, value);
        }
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders,
        });
      }

      // Unknown route — return structured 404
      logger.warn("404 Not found", { method: req.method, path: new URL(req.url).pathname });
      return jsonResponse({ error: "Not found", path: new URL(req.url).pathname }, 404);
    } catch (err: any) {
      logger.error("Unhandled error", { error: err.message, stack: err.stack });
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
});

logger.info(`Listening on http://localhost:${server.port}`);
