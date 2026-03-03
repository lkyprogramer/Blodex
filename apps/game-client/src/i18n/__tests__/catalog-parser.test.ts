import { describe, expect, it } from "vitest";
import { extractCatalogMessages } from "../catalogDiagnostics";

describe("extractCatalogMessages", () => {
  it("parses ui/log entries when values contain quotes", () => {
    const source = `
      export const TEST_CATALOG = {
        locale: "en-US",
        messages: {
          "ui.meta.quote": "Don't stop",
          'ui.meta.double': 'He said "go"',
          "ui.meta.escaped": "Use \\"quoted\\" text",
          \`ui.meta.template\`: \`line 1
line 2\`,
          "content.misc": "should be ignored",
          "log.run.start": "Run started"
        }
      } as const;
    `;

    const messages = extractCatalogMessages(source);

    expect(messages["ui.meta.quote"]).toBe("Don't stop");
    expect(messages["ui.meta.double"]).toBe('He said "go"');
    expect(messages["ui.meta.escaped"]).toBe('Use \\"quoted\\" text');
    expect(messages["ui.meta.template"]).toBe("line 1\nline 2");
    expect(messages["log.run.start"]).toBe("Run started");
    expect(messages).not.toHaveProperty("content.misc");
  });
});
