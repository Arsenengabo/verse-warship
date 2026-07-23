import { supabase } from "@/integrations/supabase/client";
import { loadLocalFavorites, saveLocalFavorites } from "./verse-settings";

export async function listFavoriteIds(userId: string | null): Promise<string[]> {
  if (!userId) return loadLocalFavorites();
  const { data, error } = await supabase
    .from("favorites")
    .select("verse_id")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => r.verse_id as string);
}

export async function addFavorite(userId: string | null, verseId: string) {
  if (!userId) {
    const cur = loadLocalFavorites();
    if (!cur.includes(verseId)) saveLocalFavorites([verseId, ...cur]);
    return;
  }
  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: userId, verse_id: verseId });
  if (error && !`${error.message}`.includes("duplicate")) throw error;
}

export async function removeFavorite(userId: string | null, verseId: string) {
  if (!userId) {
    saveLocalFavorites(loadLocalFavorites().filter((v) => v !== verseId));
    return;
  }
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("verse_id", verseId);
  if (error) throw error;
}