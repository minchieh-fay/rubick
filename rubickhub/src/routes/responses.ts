import { readFileSync, existsSync } from "fs";

export type ServerRequest = Request;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE, PUT",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Return JSON response with CORS */
export function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/** Return plain text response */
export function text(data: string, status = 200): Response {
  return new Response(data, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

/** Return file response, 404 if not found, with CORS */
export function file(filePath: string): Response {
  if (!existsSync(filePath)) {
    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  }

  const buffer = readFileSync(filePath);
  const contentType = getContentType(filePath);
  return new Response(buffer, {
    headers: { "Content-Type": contentType, ...CORS_HEADERS },
  });
}

function getContentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    zip: "application/zip",
    png: "image/png",
    jpg: "image/jpeg",
    svg: "image/svg+xml",
  };
  return map[ext || ""] || "application/octet-stream";
}
