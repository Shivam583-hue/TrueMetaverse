import { describe, expect, test } from "bun:test";
import { compare, hash } from "./scrypt";

describe("scrypt", () => {
  test("round-trips a hashed password", async () => {
    const stored = await hash("correct horse battery staple");
    expect(stored).toMatch(/^[0-9a-f]{32}\.[0-9a-f]{64}$/);
    expect(await compare("correct horse battery staple", stored)).toBe(true);
  });

  test("rejects a wrong password", async () => {
    const stored = await hash("correct horse battery staple");
    expect(await compare("incorrect horse battery staple", stored)).toBe(false);
  });

  test("produces a distinct salt per call", async () => {
    const [a, b] = await Promise.all([hash("same"), hash("same")]);
    expect(a).not.toBe(b);
  });

  test("resolves false for a stored value with no separator", async () => {
    expect(await compare("anything", "!locked")).toBe(false);
  });

  test("resolves false for a stored value with a non-hex key", async () => {
    expect(await compare("anything", "abcd.not-hex-at-all")).toBe(false);
  });

  test("resolves false for a stored key of the wrong length", async () => {
    expect(await compare("anything", "abcd.beef")).toBe(false);
  });

  test("resolves false for an empty stored value", async () => {
    expect(await compare("anything", "")).toBe(false);
  });
});
