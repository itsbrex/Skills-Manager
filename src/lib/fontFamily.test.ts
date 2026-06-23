import { test } from "node:test";
import assert from "node:assert/strict";

test("font family utility exposes stacks for supported presets", async () => {
  const fontFamily = await import("./fontFamily.ts").catch(() => ({}));

  assert.equal(typeof (fontFamily as { getFontFamilyStack?: unknown }).getFontFamilyStack, "function");

  const getFontFamilyStack = (fontFamily as { getFontFamilyStack: (preset: string) => string }).getFontFamilyStack;
  const defaultStack = getFontFamilyStack("default");
  const serif = getFontFamilyStack("serif");

  assert.match(defaultStack, /Inter/i);
  assert.match(defaultStack, /sans-serif/i);
  assert.match(serif, /serif/i);
  assert.notEqual(defaultStack, serif);
});

test("font family utility maps legacy and unknown presets to default", async () => {
  const fontFamily = await import("./fontFamily.ts").catch(() => ({}));

  assert.equal(typeof (fontFamily as { getFontFamilyStack?: unknown }).getFontFamilyStack, "function");

  const getFontFamilyStack = (fontFamily as { getFontFamilyStack: (preset: string) => string }).getFontFamilyStack;
  assert.equal(getFontFamilyStack("unknown"), getFontFamilyStack("default"));
  assert.equal(getFontFamilyStack("raycast"), getFontFamilyStack("default"));
  assert.equal(getFontFamilyStack("system"), getFontFamilyStack("default"));
  assert.equal(getFontFamilyStack("rounded"), getFontFamilyStack("default"));
});

test("normalizeFontFamilyPreset accepts default/serif and maps everything else to default", async () => {
  const fontFamily = await import("./fontFamily.ts").catch(() => ({}));
  const normalize = (fontFamily as { normalizeFontFamilyPreset: (p: string | null | undefined) => string }).normalizeFontFamilyPreset;

  assert.equal(normalize("default"), "default");
  assert.equal(normalize("serif"), "serif");
  assert.equal(normalize("raycast"), "default");
  assert.equal(normalize("system"), "default");
  assert.equal(normalize("rounded"), "default");
  assert.equal(normalize(null), "default");
  assert.equal(normalize("bogus"), "default");
});
