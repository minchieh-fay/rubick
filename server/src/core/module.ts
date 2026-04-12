export interface ServerModuleManifest {
  name: string;
  basePath: string;
  description?: string;
}

export interface ServerModule {
  manifest: ServerModuleManifest;
  register?: () => Promise<void> | void;
  start?: () => Promise<void> | void;
}
