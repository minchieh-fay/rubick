import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import type { PackageType, PackageMeta, ClientVersion } from "../types";

const DATA_DIR = join(process.cwd(), "data");
const PACKAGE_TYPES: PackageType[] = ["app", "skill", "mcp"];

/** Ensure data directory structure exists */
export function ensureDataDirs(): void {
  const dirs = ["apps", "skills", "mcps", "clients"];
  for (const dir of dirs) {
    const fullPath = join(DATA_DIR, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  }

  // Initialize json files if not exist
  for (const type of PACKAGE_TYPES) {
    const jsonPath = jsonPathFor(type);
    if (!existsSync(jsonPath)) {
      writeFileSync(jsonPath, "[]", "utf-8");
    }
  }
}

function jsonPathFor(type: PackageType): string {
  return join(DATA_DIR, `${type}s.json`);
}

function packageDirFor(type: PackageType): string {
  return join(DATA_DIR, `${type}s`);
}

// ─── Package operations ───────────────────────────────────────

export function listPackages(type: PackageType): PackageMeta[] {
  const json = readFileSync(jsonPathFor(type), "utf-8");
  return JSON.parse(json) as PackageMeta[];
}

export function savePackages(type: PackageType, packages: PackageMeta[]): void {
  writeFileSync(jsonPathFor(type), JSON.stringify(packages, null, 2), "utf-8");
}

export function addPackage(type: PackageType, meta: PackageMeta): void {
  const packages = listPackages(type);
  packages.push(meta);
  savePackages(type, packages);
}

export function findPackage(type: PackageType, name: string): PackageMeta | undefined {
  return listPackages(type).find((p) => p.name === name);
}

export function savePackageFile(type: PackageType, fileName: string, buffer: ArrayBuffer): void {
  const dir = packageDirFor(type);
  const filePath = join(dir, fileName);
  writeFileSync(filePath, Buffer.from(buffer));
}

/** List all client files in data/clients/ */
export function listClients(): ClientVersion[] {
  const dir = join(DATA_DIR, "clients");
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir);
  return files.map((fileName) => {
    // Parse filename: {name}-{version}-{platform}.{ext}
    // e.g. rubick-1.0.0-win.exe
    const parts = fileName.split("-");
    const name = parts[0] as "rubick" | "rubicktool";
    const version = parts[1] || "unknown";
    const rest = parts.slice(2).join("-"); // platform.ext
    const platform = rest.split(".")[0] || "unknown";

    return {
      name,
      version,
      fileName,
      platform,
      downloadUrl: `/api/clients/${fileName}`,
    };
  });
}

/** Get latest version for a client name */
export function getLatestClient(name: "rubick" | "rubicktool"): ClientVersion | undefined {
  const clients = listClients();
  const matched = clients.filter((c) => c.name === name);
  // Return the first one (can be improved with semver sort later)
  return matched[0];
}

/** Delete a package and its metadata */
export function deletePackage(type: PackageType, name: string): boolean {
  const packages = listPackages(type);
  const idx = packages.findIndex((p) => p.name === name);
  if (idx === -1) return false;

  const pkg = packages[idx];
  const filePath = join(packageDirFor(type), pkg.fileName);

  // Remove zip file if exists
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }

  // Remove from metadata
  packages.splice(idx, 1);
  savePackages(type, packages);
  return true;
}

/** Update package version (replace old zip with new version, preserve stats) */
export function updatePackage(type: PackageType, name: string, newMeta: Partial<PackageMeta>): PackageMeta | null {
  const packages = listPackages(type);
  const idx = packages.findIndex((p) => p.name === name);
  if (idx === -1) return null;

  const old = packages[idx];

  // Remove old zip file if exists
  if (old.fileName) {
    const oldPath = join(packageDirFor(type), old.fileName);
    if (existsSync(oldPath)) {
      unlinkSync(oldPath);
    }
  }

  // Merge: preserve downloads and usageCount unless explicitly overridden
  packages[idx] = { ...old, ...newMeta };
  savePackages(type, packages);
  return packages[idx];
}
