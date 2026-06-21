export const FONT_FAMILY_PRESETS = ["raycast", "system", "rounded", "serif"] as const;

export type FontFamilyPreset = (typeof FONT_FAMILY_PRESETS)[number];

const RAYCAST_FONT_STACK = [
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

const SYSTEM_FONT_STACK = [
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

const ROUNDED_FONT_STACK = [
  "\"SF Pro Rounded\"",
  "\"ui-rounded\"",
  "\"Nunito\"",
  "\"Hiragino Maru Gothic ProN\"",
  "\"Segoe UI\"",
  "\"PingFang SC\"",
  "\"Microsoft YaHei\"",
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
  if (preset === "system" || preset === "rounded" || preset === "serif") {
    return preset;
  }

  return "raycast";
}

export function getFontFamilyStack(preset: string | null | undefined): string {
  switch (normalizeFontFamilyPreset(preset)) {
    case "system":
      return SYSTEM_FONT_STACK;
    case "rounded":
      return ROUNDED_FONT_STACK;
    case "serif":
      return SERIF_FONT_STACK;
    case "raycast":
    default:
      return RAYCAST_FONT_STACK;
  }
}
