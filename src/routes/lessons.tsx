import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/lessons")({
  head: () => ({
    meta: [
      { title: "Lessons — Verse" },
      { name: "description", content: "Bible study and lesson-prep tools are coming to Verse. Build outlines from scripture." },
      { property: "og:title", content: "Lessons — Verse" },
      { property: "og:description", content: "Bible study tools, coming soon." },
    ],
  }),
  component: LessonsPage,
});

function LessonsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-8 sm:pt-12">
      <h1 className="text-3xl font-bold tracking-tight">Lessons</h1>
      <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
        <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold">Coming soon</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          A simple lesson builder — pick your scripture, write your notes,
          and share with your group. We're building it next.
        </p>
      </div>
    </div>
  );
}