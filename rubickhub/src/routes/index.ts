import { type ServerRequest, json, text, file } from "./responses";
import {
  ensureDataDirs,
  listPackages,
  addPackage,
  findPackage,
  savePackageFile,
  savePackages,
  listClients,
  getLatestClient,
} from "../services/data";

export function handleRoutes(req: ServerRequest): Response | null {
  const { method, url } = req;
  const path = new URL(url).pathname;

  // ─── Static files ──────────────────────────────────────
  if (path === "/" || path === "/index.html") {
    return file("./public/index.html");
  }

  // ─── API: list packages ────────────────────────────────
  if (path.match(/^\/api\/(apps|skills|mcps)$/)) {
    const plural = path.split("/").pop()!;
    const type = plural.slice(0, -1) as "app" | "skill" | "mcp";

    if (method === "GET") {
      const packages = listPackages(type);
      const sortBy = new URL(url).searchParams.get("sort") || "usageCount";
      const sorted = sortPackages(packages, sortBy);
      return json(sorted);
    }
  }

  // ─── API: upload package ───────────────────────────────
  if (path.match(/^\/api\/(apps|skills|mcps)\/upload$/)) {
    const plural = path.split("/")[2]!;
    const type = plural.slice(0, -1);

    if (method === "POST") {
      return handleUpload(req, type);
    }
  }

  // ─── API: download package ─────────────────────────────
  if (path.match(/^\/api\/(apps|skills|mcps)\/download\//)) {
    const parts = path.split("/");
    const plural = parts[2]!;
    const type = plural.slice(0, -1);
    const fileName = parts[4];

    if (method === "GET" && fileName) {
      return handleDownload(type, fileName);
    }
  }

  // ─── API: report usage ─────────────────────────────────
  if (path === "/api/usage/report" && method === "POST") {
    return handleUsageReport(req);
  }

  // ─── API: client version check ─────────────────────────
  if (path === "/api/clients/latest" && method === "GET") {
    const name = new URL(url).searchParams.get("name") as "rubick" | "rubicktool" | null;
    if (name) {
      const latest = getLatestClient(name);
      return latest ? json(latest) : json(null);
    }
    return json({ clients: listClients() });
  }

  // ─── API: client download list ─────────────────────────
  if (path === "/api/clients" && method === "GET") {
    return json({ clients: listClients() });
  }

  // ─── API: download client file ─────────────────────────
  if (path.match(/^\/api\/clients\//)) {
    const fileName = path.split("/").pop()!;
    const filePath = `./data/clients/${fileName}`;
    return file(filePath);
  }

  return null; // not handled, let caller 404
}

// ─── Helpers ──────────────────────────────────────────────────

function sortPackages(packages: any[], sortBy: string): any[] {
  return packages.sort((a, b) => {
    switch (sortBy) {
      case "downloads":
        return (b.downloads || 0) - (a.downloads || 0);
      case "usageCount":
      default:
        return (b.usageCount || 0) - (a.usageCount || 0);
    }
  });
}

async function handleUpload(req: ServerRequest, type: string): Promise<Response> {
  try {
    const formData = await req.formData();
    const zipFile = formData.get("file") as File | null;
    const author = formData.get("author") as string;
    const email = formData.get("email") as string;

    if (!zipFile) {
      return json({ error: "Missing file" }, 400);
    }

    const fileName = zipFile.name;
    const buffer = await zipFile.arrayBuffer();

    // Parse package name from filename
    // Format: {type}-{descriptive-name}-{timestamp}-{version}.zip
    const nameMatch = fileName.match(/^(?:app|skill|mcp)-(.+)-\d{14}-(\d+\.\d+\.\d+)\.zip$/);
    if (!nameMatch) {
      return json({ error: "Invalid package filename format" }, 400);
    }

    const descriptiveName = nameMatch[1];
    const version = nameMatch[2];

    // Check duplicate
    if (findPackage(type as any, descriptiveName)) {
      return json({ error: `Package "${descriptiveName}" already exists` }, 409);
    }

    // Save file and metadata
    savePackageFile(type as any, fileName, buffer);
    addPackage(type as any, {
      name: descriptiveName,
      version,
      author: author || "unknown",
      email: email || "",
      fileName,
      uploadedAt: new Date().toISOString(),
      downloads: 0,
      usageCount: 0,
    });

    return json({ success: true, name: descriptiveName, version });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}

function handleDownload(type: string, fileName: string): Response {
  const packages = listPackages(type as any);
  const pkg = packages.find((p) => p.fileName === fileName);

  if (!pkg) {
    return json({ error: "Package not found" }, 404);
  }

  // Increment download count
  pkg.downloads += 1;
  savePackages(type as any, packages);

  const filePath = `./data/${type}s/${fileName}`;
  return file(filePath);
}

async function handleUsageReport(req: ServerRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { appName } = body;

    if (!appName) {
      return json({ error: "Missing appName" }, 400);
    }

    const packages = listPackages("app");
    const pkg = packages.find((p) => p.name === appName);
    if (pkg) {
      pkg.usageCount += 1;
      savePackages("app", packages);
    }

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
