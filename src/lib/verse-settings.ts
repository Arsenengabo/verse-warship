// Local-first settings and current-verse persistence. Works for guest users.

export type IntervalUnit = "minute" | "hour" | "day" | "week";
export type Position = "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";
export type FontStyle = "system" | "serif-italic";
export type TextSize = "sm" | "md" | "lg";
export type Theme = "light" | "dark" | "auto";

export interface VerseSettings {
  intervalValue: number;
  intervalUnit: IntervalUnit;
  position: Position;
  fontStyle: FontStyle;
  textSize: TextSize;
  theme: Theme;
  translation: string; // "all" or a specific translation
  notificationsEnabled: boolean;
}

export const DEFAULT_SETTINGS: VerseSettings = {
  intervalValue: 1,
  intervalUnit: "hour",
  position: "center",
  fontStyle: "serif-italic",
  textSize: "md",
  theme: "auto",
  translation: "all",
  notificationsEnabled: false,
};

const SETTINGS_KEY = "verse.settings.v1";
const CURRENT_KEY = "verse.current.v1";

export interface CurrentVerseState {
  verseId: string | null;
  nextRefreshAt: number; // epoch ms
}

export function loadSettings(): VerseSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: VerseSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadCurrent(): CurrentVerseState {
  if (typeof window === "undefined") return { verseId: null, nextRefreshAt: 0 };
  try {
    const raw = window.localStorage.getItem(CURRENT_KEY);
    if (!raw) return { verseId: null, nextRefreshAt: 0 };
    return JSON.parse(raw);
  } catch {
    return { verseId: null, nextRefreshAt: 0 };
  }
}

export function saveCurrent(state: CurrentVerseState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
}

export function intervalToMs(value: number, unit: IntervalUnit): number {
  const v = Math.max(1, Math.floor(value));
  switch (unit) {
    case "minute": return v * 60_000;
    case "hour": return v * 3_600_000;
    case "day": return v * 86_400_000;
    case "week": return v * 7 * 86_400_000;
  }
}

// Local guest favorites (mirrored to Supabase when signed in)
const LOCAL_FAV_KEY = "verse.favorites.v1";
export function loadLocalFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_FAV_KEY) ?? "[]");
  } catch { return []; }
}
export function saveLocalFavorites(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_FAV_KEY, JSON.stringify(ids));
}