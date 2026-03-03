import type { LogLevel } from "../../../ui/Hud";
import type { I18nService, MessageParams } from "../../../i18n/types";

export interface LogOutput {
  message: string;
  level: LogLevel;
  timestampMs: number;
}

export interface RawLogEvent {
  type: "raw";
  message: string;
  level?: LogLevel;
  timestampMs: number;
}

export interface DebugLogEvent {
  type: "debug";
  message: string;
  level?: LogLevel;
  timestampMs: number;
}

export interface KeyedLogEvent {
  type: "key";
  key: string;
  params?: MessageParams;
  level?: LogLevel;
  timestampMs: number;
}

export type RunLogEvent = RawLogEvent | DebugLogEvent | KeyedLogEvent;

export function resolveRunLogEvent(event: RunLogEvent, i18n?: I18nService): LogOutput {
  if (event.type === "key") {
    return {
      message: i18n?.t(event.key, event.params) ?? event.key,
      level: event.level ?? "info",
      timestampMs: event.timestampMs
    };
  }

  if (event.type === "debug") {
    return {
      message: i18n?.t("log.debug.prefix", { message: event.message }) ?? `[Debug] ${event.message}`,
      level: event.level ?? "info",
      timestampMs: event.timestampMs
    };
  }

  return {
    message: event.message,
    level: event.level ?? "info",
    timestampMs: event.timestampMs
  };
}
