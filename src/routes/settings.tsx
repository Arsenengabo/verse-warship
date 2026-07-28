import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type FontStyle,
  type IntervalUnit,
  type Position,
  type TextSize,
  type Theme,
  type VerseSettings,
} from "@/lib/verse-settings";
import { applyTheme } from "@/lib/theme";
import { subscribeToVersePush, unsubscribeFromVersePush } from "@/lib/push-subscribe";
import {
  isNativeWallpaperAvailable,
  enableWallpaperRotation,
  disableWallpaperRotation,
  applyWallpaperNow,
} from "@/lib/wallpaper";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Verse" },
      { name: "description", content: "Adjust rotation rhythm, card position, typography, theme, and notifications for Verse." },
      { property: "og:title", content: "Settings — Verse" },
      { property: "og:description", content: "Tune Verse to your rhythm and reading style." },
    ],
  }),
  component: SettingsPage,
});

const positions: { value: Position; label: string }[] = [
  { value: "top-left", label: "Top-left" },
  { value: "top-right", label: "Top-right" },
  { value: "center", label: "Center" },
  { value: "bottom-left", label: "Bottom-left" },
  { value: "bottom-right", label: "Bottom-right" },
];

function SettingsPage() {
  const [s, setS] = useState<VerseSettings>(DEFAULT_SETTINGS);
  const [wallpaperEnabled, setWallpaperEnabled] = useState(
    () => window.localStorage.getItem("verse.wallpaper.enabled.v1") === "true",
  );

  async function toggleWallpaper(enabled: boolean) {
    if (!enabled) {
      await disableWallpaperRotation();
      setWallpaperEnabled(false);
      window.localStorage.setItem("verse.wallpaper.enabled.v1", "false");
      toast.success("Lock screen wallpaper rotation turned off.");
      return;
    }
    const result = await enableWallpaperRotation(s.intervalValue, s.intervalUnit);
    setWallpaperEnabled(result.ok);
    window.localStorage.setItem("verse.wallpaper.enabled.v1", String(result.ok));
    if (result.ok) {
      toast.success(result.note ?? "Lock screen wallpaper will rotate automatically.");
    } else {
      toast.error(result.note ?? "Couldn't enable wallpaper rotation.");
    }
  }

  useEffect(() => {
    setS(loadSettings());
  }, []);

  function update<K extends keyof VerseSettings>(key: K, value: VerseSettings[K]) {
    setS((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      if (key === "theme") applyTheme(value as Theme);
      // Keep the server-side push schedule in sync with rotation/translation changes.
      if (next.notificationsEnabled && (key === "intervalValue" || key === "intervalUnit" || key === "translation")) {
        subscribeToVersePush({
          intervalValue: next.intervalValue,
          intervalUnit: next.intervalUnit,
          translation: next.translation,
        });
      }
      return next;
    });
  }

  async function toggleNotifications(enabled: boolean) {
    if (!enabled) {
      await unsubscribeFromVersePush();
      update("notificationsEnabled", false);
      toast.success("Verse push notifications turned off.");
      return;
    }

    const result = await subscribeToVersePush({
      intervalValue: s.intervalValue,
      intervalUnit: s.intervalUnit,
      translation: s.translation,
    });

    if (result.ok) {
      update("notificationsEnabled", true);
      toast.success("You'll get a verse on your lock screen even when the app is closed.");
    } else {
      update("notificationsEnabled", false);
      const messages: Record<string, string> = {
        unsupported: "This browser doesn't support push notifications.",
        "permission-denied": "Permission denied. Enable notifications in your browser/device settings.",
        "no-vapid-key": "Push isn't configured yet (missing VAPID key).",
        error: result.message ?? "Something went wrong subscribing to notifications.",
      };
      toast.error(messages[result.reason] ?? "Couldn't enable notifications.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-8 sm:pt-12">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every choice is saved on this device. Sign in to sync favorites across devices.
      </p>

      <Section title="Rotation" description="How often should a new verse appear?">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="interval-value">Interval value</label>
          <input
            id="interval-value"
            type="number"
            min={1}
            value={s.intervalValue}
            onChange={(e) => update("intervalValue", Math.max(1, Number(e.target.value) || 1))}
            className="h-11 w-20 rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <label className="sr-only" htmlFor="interval-unit">Interval unit</label>
          <select
            id="interval-unit"
            value={s.intervalUnit}
            onChange={(e) => update("intervalUnit", e.target.value as IntervalUnit)}
            className="h-11 rounded-lg border border-input bg-background px-3 text-base"
          >
            <option value="minute">minute(s)</option>
            <option value="hour">hour(s)</option>
            <option value="day">day(s)</option>
            <option value="week">week(s)</option>
          </select>
        </div>
      </Section>

      <Section title="Position" description="Where the verse card anchors on the screen.">
        <div className="grid grid-cols-3 gap-2 max-w-xs">
          {[
            "top-left",
            null,
            "top-right",
            null,
            "center",
            null,
            "bottom-left",
            null,
            "bottom-right",
          ].map((p, i) =>
            p === null ? (
              <div key={`spacer-${i}`} />
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => update("position", p as Position)}
                aria-label={positions.find((x) => x.value === p)?.label}
                aria-pressed={s.position === p}
                className={`aspect-square rounded-lg border-2 transition ${
                  s.position === p
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <span className="sr-only">{p}</span>
              </button>
            )
          )}
        </div>
      </Section>

      <Section title="Typography" description="Font style and reading size.">
        <RadioRow
          name="font"
          value={s.fontStyle}
          options={[
            { value: "system", label: "System" },
            { value: "serif-italic", label: "Serif italic" },
          ]}
          onChange={(v) => update("fontStyle", v as FontStyle)}
        />
        <RadioRow
          className="mt-3"
          name="size"
          value={s.textSize}
          options={[
            { value: "sm", label: "Small" },
            { value: "md", label: "Medium" },
            { value: "lg", label: "Large" },
          ]}
          onChange={(v) => update("textSize", v as TextSize)}
        />
      </Section>

      <Section title="Theme">
        <RadioRow
          name="theme"
          value={s.theme}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "auto", label: "Auto" },
          ]}
          onChange={(v) => update("theme", v as Theme)}
        />
      </Section>

      <Section title="Notifications" description="Verse alerts on your lock screen, even when Verse is closed. On iOS, add Verse to your Home Screen first (Share → Add to Home Screen) — Safari only supports this for installed apps.">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={s.notificationsEnabled}
            onChange={(e) => toggleNotifications(e.target.checked)}
            className="h-5 w-5 rounded border-input accent-primary"
          />
          <span>Show verse alerts</span>
        </label>
      </Section>

      {isNativeWallpaperAvailable() && (
        <Section
          title="Lock screen wallpaper"
          description="Automatically sets your lock screen to a new verse on a schedule, even while Verse is fully closed. Android limits background updates to every 15 minutes minimum."
        >
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={wallpaperEnabled}
              onChange={(e) => toggleWallpaper(e.target.checked)}
              className="h-5 w-5 rounded border-input accent-primary"
            />
            <span>Rotate lock screen wallpaper</span>
          </label>
          <button
            type="button"
            onClick={async () => {
              const applied = await applyWallpaperNow();
              toast[applied ? "success" : "error"](applied ? "Lock screen updated." : "Couldn't set wallpaper.");
            }}
            className="mt-3 rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent"
          >
            Set wallpaper now
          </button>
        </Section>
      )}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RadioRow({
  name,
  value,
  options,
  onChange,
  className,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            type="button"
            key={opt.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition ${
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}