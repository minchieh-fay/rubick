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
  deletePackage,
  updatePackage,
} from "../services/data";
import { logger } from "../services/logger";

export function handleRoutes(req: ServerRequest): Response | null {
  const { method, url } = req;
  const path = new URL(url).pathname;

  logger.debug(`${method} ${path}`);

  // ─── Static files ──────────────────────────────────────
  if (path === "/" || path === "/index.html") {
    return file("./public/index.html");
  }

  // ─── API: list packages (with pagination) ──────────────
  if (path.match(/^\/api\/(apps|skills|mcps)$/)) {
    const plural = path.split("/").pop()!;
    const type = plural.slice(0, -1) as "app" | "skill" | "mcp";

    if (method === "GET") {
      return handleListPackages(req, type);
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

  // ─── API: delete package ───────────────────────────────
  if (path.match(/^\/api\/(apps|skills|mcps)\/[a-zA-Z0-9_\u4e00-\u9fa5-]+$/)) {
    const plural = path.split("/")[2]!;
    const type = plural.slice(0, -1);
    const name = path.split("/")[3];

    if (name && !["upload", "download"].includes(name)) {
      if (method === "DELETE") {
        return handleDeletePackage(type, name);
      }
      if (method === "PUT") {
        return handleUpdatePackage(req, type, name);
      }
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
      logger.warn("Upload failed: missing file", { type, author });
      return json({ error: "Missing file" }, 400);
    }

    const fileName = zipFile.name;
    const buffer = await zipFile.arrayBuffer();

    // Parse package name from filename
    // Format: {type}-{descriptive-name}-{timestamp}-{version}.zip
    const nameMatch = fileName.match(/^(?:app|skill|mcp)-(.+)-\d{14}-(\d+\.\d+\.\d+)\.zip$/);
    if (!nameMatch) {
      logger.warn("Upload failed: invalid filename format", { fileName });
      return json({ error: "Invalid package filename format" }, 400);
    }

    const descriptiveName = nameMatch[1];
    const version = nameMatch[2];

    // Check duplicate
    if (findPackage(type as any, descriptiveName)) {
      logger.warn("Upload failed: package already exists", { type, name: descriptiveName });
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

    logger.info(`Package uploaded`, { type, name: descriptiveName, version, author });
    return json({ success: true, name: descriptiveName, version });
  } catch (err: any) {
    logger.error("Upload error", { error: err.message });
    return json({ error: err.message }, 500);
  }
}

function handleDownload(type: string, fileName: string): Response {
  const packages = listPackages(type as any);
  const pkg = packages.find((p) => p.fileName === fileName);

  if (!pkg) {
    logger.warn("Download failed: package not found", { type, fileName });
    return json({ error: "Package not found" }, 404);
  }

  // Increment download count
  pkg.downloads += 1;
  savePackages(type as any, packages);

  logger.info(`Package downloaded`, { type, name: pkg.name, downloads: pkg.downloads });
  const filePath = `./data/${type}s/${fileName}`;
  return file(filePath);
}

async function handleUsageReport(req: ServerRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { appName } = body;

    if (!appName) {
      logger.warn("Usage report failed: missing appName");
      return json({ error: "Missing appName" }, 400);
    }

    const packages = listPackages("app");
    const pkg = packages.find((p) => p.name === appName);
    if (pkg) {
      pkg.usageCount += 1;
      savePackages("app", packages);
      logger.info("Usage reported", { appName, usageCount: pkg.usageCount });
    } else {
      logger.warn("Usage report: app not found", { appName });
    }

    return json({ success: true });
  } catch (err: any) {
    logger.error("Usage report error", { error: err.message });
    return json({ error: err.message }, 500);
  }
}

function handleListPackages(req: ServerRequest, type: string): Response {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") || "";
  const authorFilter = url.searchParams.get("author") || "";
  const sortBy = url.searchParams.get("sort") || "usageCount";

  // Pagination params
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20")));

  let packages = listPackages(type as any);

  // Filter by search query (matches name or author)
  if (query) {
    const q = query.toLowerCase();
    packages = packages.filter(
      (p) => p.name.toLowerCase().includes(q) || p.author.toLowerCase().includes(q)
    );
  }

  // Filter by author
  if (authorFilter) {
    const author = authorFilter.toLowerCase();
    packages = packages.filter((p) => p.author.toLowerCase().includes(author));
  }

  const total = packages.length;
  const sorted = sortPackages(packages, sortBy);

  // Apply pagination
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const items = sorted.slice(startIndex, endIndex);

  logger.info(`List ${type}s`, { total, page, pageSize, query, author: authorFilter, sortBy });

  return json({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

function handleDeletePackage(type: string, name: string): Response {
  const decodedName = decodeURIComponent(name);
  const found = deletePackage(type as any, decodedName);

  if (!found) {
    logger.warn("Delete failed: package not found", { type, name: decodedName });
    return json({ error: "Package not found" }, 404);
  }

  logger.info("Package deleted", { type, name: decodedName });
  return json({ success: true, name: decodedName });
}

async function handleUpdatePackage(req: ServerRequest, type: string, name: string): Promise<Response> {
  try {
    const decodedName = decodeURIComponent(name);
    const formData = await req.formData();
    const zipFile = formData.get("file") as File | null;
    const author = formData.get("author") as string | undefined;
    const email = formData.get("email") as string | undefined;

    if (!zipFile) {
      logger.warn("Update failed: missing file", { type, name: decodedName });
      return json({ error: "Missing file" }, 400);
    }

    // Parse new version from filename
    const fileName = zipFile.name;
    const nameMatch = fileName.match(/^(?:app|skill|mcp)-(.+)-\d{14}-(\d+\.\d+\.\d+)\.zip$/);
    if (!nameMatch) {
      logger.warn("Update failed: invalid filename format", { fileName });
      return json({ error: "Invalid package filename format" }, 400);
    }

    const newName = nameMatch[1];
    const version = nameMatch[2];

    // Verify name matches
    if (newName !== decodedName) {
      logger.warn("Update failed: name mismatch", { expected: decodedName, got: newName });
      return json({ error: "Package name in filename does not match URL" }, 400);
    }

    const buffer = await zipFile.arrayBuffer();
    savePackageFile(type as any, fileName, buffer);

    const updated = updatePackage(type as any, decodedName, {
      version,
      author: author,
      email: email,
      fileName,
      uploadedAt: new Date().toISOString(),
    });

    if (!updated) {
      logger.warn("Update failed: package not found", { type, name: decodedName });
      return json({ error: "Package not found" }, 404);
    }

    logger.info("Package updated", { type, name: decodedName, version });
    return json({ success: true, name: decodedName, version });
  } catch (err: any) {
    logger.error("Update error", { error: err.message });
    return json({ error: err.message }, 500);
  }
}
