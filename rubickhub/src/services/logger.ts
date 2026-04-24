/** Simple logger with levels and timestamps */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m", // green
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
};

function formatLevel(level: LogLevel): string {
  const color = LEVEL_COLORS[level] || "";
  const reset = "\x1b[0m";
  return `${color}[${level.toUpperCase()}]${reset}`;
}

function formatMessage(level: LogLevel, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const parts = [timestamp, formatLevel(level), message];
  if (data !== undefined) {
    parts.push(typeof data === "string" ? data : JSON.stringify(data));
  }
  return parts.join(" ");
}

export const logger = {
  debug(message: string, data?: unknown) {
    console.log(formatMessage("debug", message, data));
  },
  info(message: string, data?: unknown) {
    console.log(formatMessage("info", message, data));
  },
  warn(message: string, data?: unknown) {
    console.warn(formatMessage("warn", message, data));
  },
  error(message: string, error?: unknown) {
    console.error(formatMessage("error", message, error));
  },
};
