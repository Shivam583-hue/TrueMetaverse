import { describe, expect, test } from "bun:test";
import { resolvePlayerLabel } from "./playerLabel";

describe("player labels", () => {
  test("uses a cached username when a concealed player appears later", () => {
    expect(resolvePlayerLabel("user-123456789", "  Mira  ")).toBe("Mira");
  });

  test("never returns an empty label when metadata is missing", () => {
    expect(resolvePlayerLabel("user-123456789", null)).toBe("user-123");
    expect(resolvePlayerLabel("", "   ")).toBe("player");
  });
});
