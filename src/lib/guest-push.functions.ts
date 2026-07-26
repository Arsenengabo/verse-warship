import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const upsertSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
  deviceId: z.string().uuid(),
  intervalValue: z.number().int().min(1).max(1000),
  intervalUnit: z.enum(["minute", "hour", "day", "week"]),
  translation: z.string().min(1).max(32),
});

export const guestUpsertPushSubscription = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => upsertSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only touch guest rows. If a row for this endpoint already belongs to a
    // signed-in user, refuse — guest callers must not overwrite owned rows.
    const { data: existing, error: selErr } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, user_id")
      .eq("endpoint", data.endpoint)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (existing && existing.user_id) {
      throw new Error("forbidden");
    }

    const row = {
      user_id: null,
      device_id: data.deviceId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth_key: data.auth,
      interval_value: data.intervalValue,
      interval_unit: data.intervalUnit,
      translation: data.translation,
      next_send_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabaseAdmin
        .from("push_subscriptions")
        .update(row)
        .eq("id", existing.id)
        .is("user_id", null);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("push_subscriptions").insert(row);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

const deleteSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export const guestDeletePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .is("user_id", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });