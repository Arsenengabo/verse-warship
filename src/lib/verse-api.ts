import { supabase } from "@/integrations/supabase/client";

export interface Verse {
  id: string;
  reference: string;
  text: string;
  translation: string;
  tags: string[];
}

let verseCache: Verse[] | null = null;

export async function fetchAllVerses(): Promise<Verse[]> {
  if (verseCache) return verseCache;
  const { data, error } = await supabase
    .from("verses")
    .select("id, reference, text, translation, tags");
  if (error) throw error;
  verseCache = (data ?? []) as Verse[];
  // Cache offline
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("verse.cache.v1", JSON.stringify(verseCache));
    } catch {}
  }
  return verseCache;
}

export function readCachedVerses(): Verse[] {
  if (verseCache) return verseCache;
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("verse.cache.v1");
    if (!raw) return [];
    verseCache = JSON.parse(raw) as Verse[];
    return verseCache;
  } catch { return []; }
}

export function pickRandomVerse(verses: Verse[], excludeId?: string | null): Verse | null {
  if (!verses.length) return null;
  if (verses.length === 1) return verses[0];
  const pool = excludeId ? verses.filter(v => v.id !== excludeId) : verses;
  return pool[Math.floor(Math.random() * pool.length)];
}