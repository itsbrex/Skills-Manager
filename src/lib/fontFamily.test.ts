import { test } from "node:test";
import assert from "node:assert/strict";

test("font family utility exposes stacks for supported presets", async () => {
  const fontFamily = await import("./fontFamily.ts").catch(() => ({}));

  assert.equal(typeof (fontFamily as { getFontFamilyStack?: unknown }).getFontFamilyStack, "function");

  const getFontFamilyStack = (fontFamily as { getFontFamilyStack: (preset: string) => string }).getFontFamilyStack;
  const raycast = getFontFamilyStack("raycast");
  const system = getFontFamilyStack("system");
  const rounded = getFontFamilyStack("rounded");
  const serif = getFontFamilyStack("serif");

  assert.match(raycast, /Inter/i);
  assert.match(system, /sans-serif/i);
  assert.match(rounded, /sans-serif/i);
  assert.match(serif, /serif/i);
  assert.notEqual(raycast, system);
  assert.notEqual(system, rounded);
  assert.notEqual(system, serif);
});

test("font family utility falls back to raycast for unknown preset", async () => {
  const fontFamily = await import("./fontFamily.ts").catch(() => ({}));

  assert.equal(typeof (fontFamily as { getFontFamilyStack?: unknown }).getFontFamilyStack, "function");

  const getFontFamilyStack = (fontFamily as { getFontFamilyStack: (preset: string) => string }).getFontFamilyStack;
  assert.equal(getFontFamilyStack("unknown"), getFontFamilyStack("raycast"));
});

test("normalizeFontFamilyPreset accepts raycast/system/rounded/serif and defaults to raycast", async () => {
  const fontFamily = await import("./fontFamily.ts").catch(() => ({}));
  const normalize = (fontFamily as { normalizeFontFamilyPreset: (p: string | null | undefined) => string }).normalizeFontFamilyPreset;

  assert.equal(normalize("raycast"), "raycast");
  assert.equal(normalize("system"), "system");
  assert.equal(normalize("rounded"), "rounded");
  assert.equal(normalize("serif"), "serif");
  assert.equal(normalize(null), "raycast");
  assert.equal(normalize("bogus"), "raycast");
});
