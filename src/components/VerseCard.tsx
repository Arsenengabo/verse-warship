import { Heart, RotateCw, Settings as SettingsIcon } from "lucide-react";
import type { Verse } from "@/lib/verse-api";
import type { FontStyle, Position, TextSize } from "@/lib/verse-settings";
import { Link } from "@tanstack/react-router";

interface Props {
  verse: Verse | null;
  position: Position;
  fontStyle: FontStyle;
  textSize: TextSize;
  isFavorite: boolean;
  onShuffle: () => void;
  onToggleFavorite: () => void;
  nextRefreshLabel: string | null;
}

const posClass: Record<Position, string> = {
  "top-left": "items-start justify-start",
  "top-right": "items-start justify-end",
  center: "items-center justify-center",
  "bottom-left": "items-end justify-start",
  "bottom-right": "items-end justify-end",
};

const sizeClass: Record<TextSize, string> = {
  sm: "text-lg sm:text-xl",
  md: "text-2xl sm:text-3xl",
  lg: "text-3xl sm:text-5xl",
};

export function VerseCard({
  verse,
  position,
  fontStyle,
  textSize,
  isFavorite,
  onShuffle,
  onToggleFavorite,
  nextRefreshLabel,
}: Props) {
  const fontClass =
    fontStyle === "serif-italic"
      ? "font-[family-name:var(--font-serif-italic)] italic"
      : "font-[family-name:var(--font-system)]";

  return (
    <div className={`flex min-h-[100dvh] w-full p-4 sm:p-8 ${posClass[position]}`}>
      <article
        key={verse?.id ?? "empty"}
        className="animate-in fade-in slide-in-from-bottom-2 duration-500 relative w-full max-w-2xl rounded-3xl border border-border/60 bg-card/85 p-6 sm:p-10 shadow-[0_20px_60px_-20px_oklch(0.2_0.05_285_/_0.25)] backdrop-blur-md"
      >
        <div className="absolute right-4 top-4 flex gap-1">
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
            aria-pressed={isFavorite}
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Heart className={`h-5 w-5 ${isFavorite ? "fill-current text-accent" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onShuffle}
            aria-label="Next verse"
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <RotateCw className="h-5 w-5" />
          </button>
          <Link
            to="/settings"
            aria-label="Settings"
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <SettingsIcon className="h-5 w-5" />
          </Link>
        </div>

        {verse ? (
          <>
            <p className={`pr-24 leading-snug tracking-tight text-card-foreground ${sizeClass[textSize]} ${fontClass}`}>
              &ldquo;{verse.text}&rdquo;
            </p>
            <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted-foreground">
              <span className="font-medium tracking-wide uppercase">
                {verse.reference} · {verse.translation}
              </span>
              {nextRefreshLabel && <span>{nextRefreshLabel}</span>}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Loading a verse for you…</p>
        )}
      </article>
    </div>
  );
}