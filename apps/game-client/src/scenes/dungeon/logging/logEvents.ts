import type { LogLevel } from "../../../ui/Hud";

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

export type RunLogEvent = RawLogEvent | DebugLogEvent;

export function resolveRunLogEvent(event: RunLogEvent): LogOutput {
  if (event.type === "debug") {
    return {
      message: `[Debug] ${event.message}`,
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
