import { readFileSync, existsSync } from "fs";

export type ServerRequest = Request;

/** Return JSON response */
export function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Return plain text response */
export function text(data: string, status = 200): Response {
  return new Response(data, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

/** Return file response, 404 if not found */
export function file(filePath: string): Response {
  if (!existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const buffer = readFileSync(filePath);
  const contentType = getContentType(filePath);
  return new Response(buffer, {
    headers: { "Content-Type": contentType },
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
