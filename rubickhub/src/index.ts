import { handleRoutes } from "./routes";
import { ensureDataDirs } from "./services/data";

const PORT = parseInt(process.env.PORT || "3000");

// CORS headers for cross-project calls
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Initialize data directories
ensureDataDirs();

console.log(`rubickhub starting on port ${PORT}`);

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
      return new Response("Not found", { status: 404 });
    } catch (err: any) {
      console.error("[ERROR]", err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  },
});

console.log(`Listening on http://localhost:${server.port}`);
