import { createFileRoute } from "@tanstack/react-router";
import webpush from "web-push";

const INTERVAL_MS: Record<string, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
};

export const Route = createFileRoute("/api/public/hooks/send-verse-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require a shared secret so this endpoint isn't world-callable.
        const provided = request.headers.get("x-cron-secret") ?? "";
        const expected = process.env.CRON_SECRET ?? "";
        if (!expected || provided !== expected) {
          return new Response("unauthorized", { status: 401 });
        }

        const publicKey = process.env.VAPID_PUBLIC_KEY!;
        const privateKey = process.env.VAPID_PRIVATE_KEY!;
        const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
        webpush.setVapidDetails(subject, publicKey, privateKey);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: dueSubs, error: subsErr } = await supabaseAdmin
          .from("push_subscriptions")
          .select("*")
          .lte("next_send_at", new Date().toISOString())
          .limit(500);
        if (subsErr) return new Response(JSON.stringify({ error: subsErr.message }), { status: 500 });
        if (!dueSubs || dueSubs.length === 0) {
          return new Response(JSON.stringify({ sent: 0 }), {
            headers: { "content-type": "application/json" },
          });
        }

        const { data: verses, error: versesErr } = await supabaseAdmin
          .from("verses")
          .select("id, reference, text, translation");
        if (versesErr || !verses || verses.length === 0) {
          return new Response(JSON.stringify({ error: versesErr?.message ?? "no verses" }), { status: 500 });
        }

        let sent = 0;
        const staleEndpoints: string[] = [];

        await Promise.all(
          dueSubs.map(async (sub) => {
            const pool =
              sub.translation && sub.translation !== "all"
                ? verses.filter((v) => v.translation === sub.translation)
                : verses;
            const candidates = pool.filter((v) => v.id !== sub.last_verse_id);
            const source = candidates.length ? candidates : pool;
            const verse = source[Math.floor(Math.random() * source.length)];
            if (!verse) return;

            const payload = JSON.stringify({
              title: verse.reference,
              body: verse.text,
              verseId: verse.id,
              url: "/",
            });

            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth_key },
                },
                payload,
              );
              sent++;
            } catch (err: any) {
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                staleEndpoints.push(sub.endpoint);
                return;
              }
              console.error("push failed", sub.endpoint, err?.message);
              return;
            }

            const intervalMs = INTERVAL_MS[sub.interval_unit] ?? INTERVAL_MS.hour;
            const nextSendAt = new Date(
              Date.now() + Math.max(1, sub.interval_value) * intervalMs,
            ).toISOString();

            await supabaseAdmin
              .from("push_subscriptions")
              .update({ next_send_at: nextSendAt, last_verse_id: verse.id })
              .eq("id", sub.id);
          }),
        );

        if (staleEndpoints.length) {
          await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
        }

        return new Response(JSON.stringify({ sent, pruned: staleEndpoints.length }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});