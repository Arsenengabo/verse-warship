import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { fetchAllVerses, type Verse } from "@/lib/verse-api";
import { listFavoriteIds, removeFavorite } from "@/lib/favorites-api";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Favorites — Verse" },
      { name: "description", content: "Verses you've saved. Sign in to sync your favorites across every device." },
      { property: "og:title", content: "Favorites — Verse" },
      { property: "og:description", content: "Verses you've kept close." },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useAuth();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchAllVerses(), listFavoriteIds(user?.id ?? null)])
      .then(([v, i]) => {
        if (!alive) return;
        setVerses(v);
        setIds(i);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const items = useMemo(() => {
    const map = new Map(verses.map((v) => [v.id, v]));
    return ids.map((id) => map.get(id)).filter(Boolean) as Verse[];
  }, [verses, ids]);

  async function remove(id: string) {
    try {
      await removeFavorite(user?.id ?? null, id);
      setIds((prev) => prev.filter((x) => x !== id));
      toast("Removed from favorites");
    } catch (e) {
      toast.error("Could not remove");
      console.error(e);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-8 sm:pt-12">
      <h1 className="text-3xl font-bold tracking-tight">Favorites</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {user ? "Synced to your account." : "Saved on this device. Sign in to sync everywhere."}
      </p>

      {loading ? (
        <p className="mt-10 text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
          <Heart className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">No favorites yet. Tap the heart on a verse to save it.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((v) => (
            <li
              key={v.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <p className="font-[family-name:var(--font-serif-italic)] italic text-lg leading-snug text-card-foreground">
                &ldquo;{v.text}&rdquo;
              </p>
              <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                <span className="font-medium uppercase tracking-wide">
                  {v.reference} · {v.translation}
                </span>
                <button
                  type="button"
                  onClick={() => remove(v.id)}
                  aria-label={`Remove ${v.reference} from favorites`}
                  className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}