import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { VerseCard } from "@/components/VerseCard";
import {
  fetchAllVerses,
  pickRandomVerse,
  readCachedVerses,
  type Verse,
} from "@/lib/verse-api";
import {
  DEFAULT_SETTINGS,
  intervalToMs,
  loadCurrent,
  loadSettings,
  saveCurrent,
  type VerseSettings,
} from "@/lib/verse-settings";
import { applyTheme } from "@/lib/theme";
import { useAuth } from "@/lib/use-auth";
import { addFavorite, listFavoriteIds, removeFavorite } from "@/lib/favorites-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verse — a rotating Bible verse for your day" },
      { name: "description", content: "Open Verse to receive a quiet Bible verse on the rhythm you choose. Save favorites, adjust position and typography, install to your home screen." },
      { property: "og:title", content: "Verse — a rotating Bible verse for your day" },
      { property: "og:description", content: "Choose your rhythm. Receive scripture." },
    ],
  }),
  component: Index,
});

function formatCountdown(ms: number): string {
  if (ms <= 0) return "refreshing…";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `next in ${d}d ${h}h`;
  if (h > 0) return `next in ${h}h ${m}m`;
  if (m > 0) return `next in ${m}m ${sec}s`;
  return `next in ${sec}s`;
}

function Index() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<VerseSettings>(DEFAULT_SETTINGS);
  const [verses, setVerses] = useState<Verse[]>(() => readCachedVerses());
  const [current, setCurrent] = useState<Verse | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<number>(() => Date.now());
  const nextAtRef = useRef<number>(0);

  // Hydrate settings + apply theme
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    applyTheme(s.theme);
  }, []);

  // React to system dark mode when in auto
  useEffect(() => {
    if (typeof window === "undefined" || settings.theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("auto");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [settings.theme]);

  // Load verses
  useEffect(() => {
    fetchAllVerses()
      .then((v) => setVerses(v))
      .catch((e) => {
        console.warn("Falling back to cached verses:", e);
      });
  }, []);

  // Load favorites
  useEffect(() => {
    listFavoriteIds(user?.id ?? null)
      .then((ids) => setFavIds(new Set(ids)))
      .catch(() => {});
  }, [user?.id]);

  const filteredVerses = useMemo(() => {
    if (settings.translation === "all") return verses;
    return verses.filter((v) => v.translation === settings.translation);
  }, [verses, settings.translation]);

  // Initialize / restore current verse
  useEffect(() => {
    if (!filteredVerses.length) return;
    const stored = loadCurrent();
    const storedVerse = filteredVerses.find((v) => v.id === stored.verseId);
    const intervalMs = intervalToMs(settings.intervalValue, settings.intervalUnit);

    if (storedVerse && stored.nextRefreshAt > Date.now()) {
      setCurrent(storedVerse);
      nextAtRef.current = stored.nextRefreshAt;
    } else {
      const next = pickRandomVerse(filteredVerses, stored.verseId);
      if (next) {
        setCurrent(next);
        nextAtRef.current = Date.now() + intervalMs;
        saveCurrent({ verseId: next.id, nextRefreshAt: nextAtRef.current });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVerses.length]);

  // Ticker + rotation
  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (nextAtRef.current && t >= nextAtRef.current && filteredVerses.length) {
        rotate();
      }
    };
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVerses, settings.intervalValue, settings.intervalUnit, settings.notificationsEnabled]);

  const rotate = useCallback(() => {
    if (!filteredVerses.length) return;
    const next = pickRandomVerse(filteredVerses, current?.id ?? null);
    if (!next) return;
    const intervalMs = intervalToMs(settings.intervalValue, settings.intervalUnit);
    nextAtRef.current = Date.now() + intervalMs;
    setCurrent(next);
    saveCurrent({ verseId: next.id, nextRefreshAt: nextAtRef.current });

    if (
      settings.notificationsEnabled &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("Verse", { body: `"${next.text}" — ${next.reference}`, icon: "/icon-512.png" });
      } catch {}
    }
  }, [filteredVerses, current?.id, settings]);

  // When interval changes, reset countdown to new interval from now
  useEffect(() => {
    if (!current) return;
    const intervalMs = intervalToMs(settings.intervalValue, settings.intervalUnit);
    nextAtRef.current = Date.now() + intervalMs;
    saveCurrent({ verseId: current.id, nextRefreshAt: nextAtRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.intervalValue, settings.intervalUnit]);

  const toggleFavorite = useCallback(async () => {
    if (!current) return;
    const isFav = favIds.has(current.id);
    try {
      if (isFav) {
        await removeFavorite(user?.id ?? null, current.id);
        setFavIds((prev) => {
          const n = new Set(prev);
          n.delete(current.id);
          return n;
        });
        toast("Removed from favorites");
      } else {
        await addFavorite(user?.id ?? null, current.id);
        setFavIds((prev) => new Set(prev).add(current.id));
        toast("Saved to favorites", {
          description: user ? undefined : "Sign in to sync across devices.",
        });
      }
    } catch (e) {
      toast.error("Could not update favorites");
      console.error(e);
    }
  }, [current, favIds, user?.id]);

  const remainingMs = Math.max(0, nextAtRef.current - now);
  const label = current ? formatCountdown(remainingMs) : null;
  const isFav = current ? favIds.has(current.id) : false;

  return (
    <main>
      <h1 className="sr-only">Verse — a rotating Bible verse</h1>
      <VerseCard
        verse={current}
        position={settings.position}
        fontStyle={settings.fontStyle}
        textSize={settings.textSize}
        isFavorite={isFav}
        onShuffle={rotate}
        onToggleFavorite={toggleFavorite}
        nextRefreshLabel={label}
      />
    </main>
  );
}
