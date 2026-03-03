import { describe, expect, it, vi } from "vitest";
import { RunLogService } from "../RunLogService";

describe("RunLogService", () => {
  it("forwards append payload to current sink", () => {
    const sink = {
      append: vi.fn()
    };
    const runLog = new RunLogService(sink);

    runLog.append("hello", "warn", 123);

    expect(sink.append).toHaveBeenCalledOnce();
    expect(sink.append).toHaveBeenCalledWith("hello", "warn", 123);
  });

  it("prefixes debug events and preserves log level", () => {
    const sink = {
      append: vi.fn()
    };
    const runLog = new RunLogService(sink);

    runLog.debug("phase changed", "success", 456);

    expect(sink.append).toHaveBeenCalledOnce();
    expect(sink.append).toHaveBeenCalledWith("[Debug] phase changed", "success", 456);
  });

  it("supports swapping sink at runtime", () => {
    const firstSink = {
      append: vi.fn()
    };
    const secondSink = {
      append: vi.fn()
    };
    const runLog = new RunLogService(firstSink);

    runLog.append("before", "info", 1);
    runLog.setSink(secondSink);
    runLog.append("after", "info", 2);

    expect(firstSink.append).toHaveBeenCalledTimes(1);
    expect(firstSink.append).toHaveBeenCalledWith("before", "info", 1);
    expect(secondSink.append).toHaveBeenCalledTimes(1);
    expect(secondSink.append).toHaveBeenCalledWith("after", "info", 2);
  });
});
