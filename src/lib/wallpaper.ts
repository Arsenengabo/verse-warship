import { registerPlugin } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";
import type { IntervalUnit } from "@/lib/verse-settings";

export type WallpaperTarget = "home" | "lock" | "both";

interface VerseWallpaperPlugin {
  schedule(options: {
    intervalMinutes: number;
    supabaseUrl: string;
    supabaseAnonKey: string;
    target: WallpaperTarget;
  }): Promise<{ scheduled: boolean; effectiveIntervalMinutes: number }>;
  cancel(): Promise<{ cancelled: boolean }>;
  applyNow(options: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    target: WallpaperTarget;
  }): Promise<{ applied: boolean }>;
}

const VerseWallpaper = registerPlugin<VerseWallpaperPlugin>("VerseWallpaper");

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function toMinutes(intervalValue: number, intervalUnit: IntervalUnit): number {
  const unitMinutes: Record<IntervalUnit, number> = { minute: 1, hour: 60, day: 1440, week: 10080 };
  return Math.max(1, intervalValue) * unitMinutes[intervalUnit];
}

/** True only inside the native Android shell — false in a regular browser tab (and on iOS, which has no wallpaper API). */
export function isNativeWallpaperAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export interface WallpaperScheduleResult {
  ok: boolean;
  effectiveIntervalMinutes?: number;
  note?: string;
}

/**
 * Schedules the recurring wallpaper update for the chosen target(s).
 * Android enforces a 15-minute floor on background work (OS-level, not
 * something this app controls) — a "1 minute" setting will run every 15
 * minutes instead. Surface `effectiveIntervalMinutes` in the UI so the
 * person isn't surprised by that.
 */
export async function enableWallpaperRotation(
  intervalValue: number,
  intervalUnit: IntervalUnit,
  target: WallpaperTarget = "both",
): Promise<WallpaperScheduleResult> {
  if (!isNativeWallpaperAvailable()) {
    return { ok: false, note: "Wallpaper rotation only works in the installed Android app, not the browser." };
  }
  const requestedMinutes = toMinutes(intervalValue, intervalUnit);
  const result = await VerseWallpaper.schedule({
    intervalMinutes: requestedMinutes,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    target,
  });
  return {
    ok: result.scheduled,
    effectiveIntervalMinutes: result.effectiveIntervalMinutes,
    note:
      result.effectiveIntervalMinutes > requestedMinutes
        ? `Android limits background updates to every 15 minutes minimum, so the wallpaper will refresh every ${result.effectiveIntervalMinutes} minutes instead of ${requestedMinutes}.`
        : undefined,
  };
}

export async function disableWallpaperRotation(): Promise<void> {
  if (!isNativeWallpaperAvailable()) return;
  await VerseWallpaper.cancel();
}

/** Immediately renders and sets the wallpaper for the chosen target(s) to a fresh verse. */
export async function applyWallpaperNow(target: WallpaperTarget = "both"): Promise<boolean> {
  if (!isNativeWallpaperAvailable()) return false;
  const result = await VerseWallpaper.applyNow({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    target,
  });
  return result.applied;
}
