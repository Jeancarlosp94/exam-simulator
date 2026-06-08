/**
 * Theme settings shared between server (cookie read in layout) and
 * client (picker UI + quick toggle).
 */

import type {
  ThemeBrightness,
  ThemeMode,
  ThemePalette,
  ThemeSettings,
} from "@/lib/supabase/types";

export const THEME_COOKIE = "quizen-theme";
export const THEME_CHANGE_EVENT = "quizen:theme-change";

export const DEFAULT_THEME: ThemeSettings = {
  palette: "teal",
  mode: "focus",
  brightness: "dark",
};

export const PALETTES: Array<{
  id: ThemePalette;
  name: string;
  emoji: string;
  description: string;
}> = [
  {
    id: "teal",
    name: "Teal",
    emoji: "🌊",
    description: "Fresco, neutral, default.",
  },
  {
    id: "forest",
    name: "Forest",
    emoji: "🌲",
    description: "Verde profundo, naturaleza.",
  },
  {
    id: "sunset",
    name: "Sunset",
    emoji: "🌅",
    description: "Cálido coral, energía.",
  },
  {
    id: "lavender",
    name: "Lavender",
    emoji: "🌌",
    description: "Púrpura suave, calma.",
  },
];

export const MODES: Array<{
  id: ThemeMode;
  name: string;
  emoji: string;
  description: string;
}> = [
  {
    id: "focus",
    name: "Enfocado",
    emoji: "🎯",
    description: "Saturación alta, contraste fuerte. Para deep work.",
  },
  {
    id: "relax",
    name: "Relajado",
    emoji: "🌿",
    description: "Tono cálido, contraste suave. Para lecturas largas.",
  },
];

export const BRIGHTNESS_OPTIONS: Array<{
  id: ThemeBrightness;
  name: string;
}> = [
  { id: "dark", name: "Oscuro" },
  { id: "light", name: "Claro" },
];

export function serializeTheme(t: ThemeSettings): string {
  // Compact form keeps the cookie small (~30 bytes).
  return `${t.palette}|${t.mode}|${t.brightness}`;
}

export function parseTheme(raw: string | undefined | null): ThemeSettings {
  if (!raw) return DEFAULT_THEME;
  const [palette, mode, brightness] = raw.split("|");
  return {
    palette: isPalette(palette) ? palette : DEFAULT_THEME.palette,
    mode: isMode(mode) ? mode : DEFAULT_THEME.mode,
    brightness: isBrightness(brightness)
      ? brightness
      : DEFAULT_THEME.brightness,
  };
}

function isPalette(v: string | undefined): v is ThemePalette {
  return v === "teal" || v === "forest" || v === "sunset" || v === "lavender";
}
function isMode(v: string | undefined): v is ThemeMode {
  return v === "focus" || v === "relax";
}
function isBrightness(v: string | undefined): v is ThemeBrightness {
  return v === "dark" || v === "light";
}
