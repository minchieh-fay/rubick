/** Package type: app, skill, or mcp */
export type PackageType = "app" | "skill" | "mcp";

/** Metadata stored in {apps|skills|mcps}.json */
export interface PackageMeta {
  name: string;           // descriptive-name, unique key
  version: string;        // semver, e.g. "1.0.0"
  author: string;
  email: string;
  fileName: string;       // full zip file name
  uploadedAt: string;     // ISO timestamp
  downloads: number;
  usageCount: number;
}

/** Client package info for version check */
export interface ClientVersion {
  name: "rubick" | "rubicktool";
  version: string;
  fileName: string;
  platform: string;
  downloadUrl: string;
}
