import { test } from "node:test";
import assert from "node:assert/strict";

test("font family utility exposes stacks for supported presets", async () => {
  const fontFamily = await import("./fontFamily.ts").catch(() => ({}));

  assert.equal(typeof (fontFamily as { getFontFamilyStack?: unknown }).getFontFamilyStack, "function");

  const getFontFamilyStack = (fontFamily as { getFontFamilyStack: (preset: string) => string }).getFontFamilyStack;
  const system = getFontFamilyStack("system");
  const rounded = getFontFamilyStack("rounded");
  const serif = getFontFamilyStack("serif");

  assert.match(system, /sans-serif/i);
  assert.match(rounded, /sans-serif/i);
  assert.match(serif, /serif/i);
  assert.notEqual(system, rounded);
  assert.notEqual(system, serif);
});

test("font family utility falls back to system for unknown preset", async () => {
  const fontFamily = await import("./fontFamily.ts").catch(() => ({}));

  assert.equal(typeof (fontFamily as { getFontFamilyStack?: unknown }).getFontFamilyStack, "function");

  const getFontFamilyStack = (fontFamily as { getFontFamilyStack: (preset: string) => string }).getFontFamilyStack;
  assert.equal(getFontFamilyStack("unknown"), getFontFamilyStack("system"));
});
