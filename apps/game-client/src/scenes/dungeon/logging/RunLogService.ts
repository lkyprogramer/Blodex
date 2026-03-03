import type { LogLevel } from "../../../ui/Hud";
import type { RunLogEvent } from "./logEvents";
import { resolveRunLogEvent } from "./logEvents";

export interface RunLogSink {
  append: (message: string, level: LogLevel, timestampMs: number) => void;
}

export class RunLogService {
  constructor(private sink: RunLogSink) {}

  setSink(sink: RunLogSink): void {
    this.sink = sink;
  }

  append(message: string, level: LogLevel = "info", timestampMs = Date.now()): void {
    this.sink.append(message, level, timestampMs);
  }

  emit(event: RunLogEvent): void {
    const resolved = resolveRunLogEvent(event);
    this.sink.append(resolved.message, resolved.level, resolved.timestampMs);
  }

  debug(message: string, level: LogLevel = "info", timestampMs = Date.now()): void {
    this.emit({
      type: "debug",
      message,
      level,
      timestampMs
    });
  }
}
