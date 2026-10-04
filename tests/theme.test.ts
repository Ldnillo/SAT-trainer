import { describe, expect, it } from "vitest";
import { parseTheme } from "../src/lib/theme";

describe("parseTheme", () => {
  it("keeps a known choice", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  it("falls back to the device setting for a missing or unknown cookie", () => {
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("purple")).toBe("system");
  });
});
