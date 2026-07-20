export type RubickConfig = {
  port: number;
  dataDir: string;
  codexBin: string;
  codexArgs: string[];
  codexCwd: string;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  runCodex: boolean;
};

export const config: RubickConfig = {
  port: Number(Bun.env.PORT ?? 3000),
  dataDir: Bun.env.RUBICK_DATA_DIR ?? './data',
  codexBin: Bun.env.CODEX_BIN?.trim() || 'codex',
  codexArgs: Bun.env.CODEX_ARGS?.split(/\s+/).filter(Boolean) ?? [],
  codexCwd: Bun.env.CODEX_CWD ?? process.cwd(),
  llmApiKey: Bun.env.LLM_API_KEY ?? '',
  llmBaseUrl: Bun.env.LLM_BASE_URL ?? '',
  llmModel: Bun.env.LLM_MODEL ?? 'gpt-5.6-luna',
  runCodex: Bun.env.RUBICK_RUN_CODEX !== 'false',
};
