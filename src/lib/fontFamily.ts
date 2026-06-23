export const FONT_FAMILY_PRESETS = ["default", "serif"] as const;

export type FontFamilyPreset = (typeof FONT_FAMILY_PRESETS)[number];

const DEFAULT_FONT_STACK = [
  "\"Inter Variable\"",
  "\"Inter\"",
  "ui-sans-serif",
  "system-ui",
  "-apple-system",
  "BlinkMacSystemFont",
  "\"Segoe UI\"",
  "\"PingFang SC\"",
  "\"Hiragino Sans GB\"",
  "\"Microsoft YaHei\"",
  "\"Noto Sans\"",
  "Helvetica",
  "Arial",
  "sans-serif",
].join(", ");

const SERIF_FONT_STACK = [
  "\"Iowan Old Style\"",
  "\"Palatino Linotype\"",
  "\"Book Antiqua\"",
  "\"Songti SC\"",
  "\"Noto Serif CJK SC\"",
  "\"Source Han Serif SC\"",
  "Georgia",
  "\"Times New Roman\"",
  "serif",
].join(", ");

export function normalizeFontFamilyPreset(preset: string | null | undefined): FontFamilyPreset {
  if (preset === "serif") {
    return "serif";
  }

  return "default";
}

export function getFontFamilyStack(preset: string | null | undefined): string {
  switch (normalizeFontFamilyPreset(preset)) {
    case "serif":
      return SERIF_FONT_STACK;
    case "default":
    default:
      return DEFAULT_FONT_STACK;
  }
}
