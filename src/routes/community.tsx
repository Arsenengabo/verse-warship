import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community — Verse" },
      { name: "description", content: "Live gatherings and groups are coming to Verse. Meet, pray, and study together." },
      { property: "og:title", content: "Community — Verse" },
      { property: "og:description", content: "Live gatherings and groups, coming soon." },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-8 sm:pt-12">
      <h1 className="text-3xl font-bold tracking-tight">Community</h1>
      <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold">Coming soon</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Join live gatherings, form small groups, and schedule
          shared readings. Verse will meet you there.
        </p>
      </div>
    </div>
  );
}