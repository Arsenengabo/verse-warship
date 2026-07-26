import { supabase } from "@/integrations/supabase/client";
import type { IntervalUnit } from "@/lib/verse-settings";
import {
  guestUpsertPushSubscription,
  guestDeletePushSubscription,
} from "@/lib/guest-push.functions";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const DEVICE_ID_KEY = "verse.device_id.v1";

function getOrCreateDeviceId(): string {
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export interface SubscribeParams {
  intervalValue: number;
  intervalUnit: IntervalUnit;
  translation: string;
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "permission-denied" | "no-vapid-key" | "error"; message?: string };

export async function subscribeToVersePush(params: SubscribeParams): Promise<SubscribeResult> {
  if (typeof window === "undefined") return { ok: false, reason: "unsupported" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "no-vapid-key" };

  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "permission-denied" };

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
      });
    }
    const { data: userData } = await supabase.auth.getUser();
    const json = subscription.toJSON();

    if (userData?.user?.id) {
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userData.user.id,
          device_id: null,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth_key: json.keys!.auth,
          interval_value: params.intervalValue,
          interval_unit: params.intervalUnit,
          translation: params.translation,
          next_send_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
    } else {
      await guestUpsertPushSubscription({
        data: {
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
          deviceId: getOrCreateDeviceId(),
          intervalValue: params.intervalValue,
          intervalUnit: params.intervalUnit,
          translation: params.translation,
        },
      });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export async function unsubscribeFromVersePush(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user?.id) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } else {
    try {
      await guestDeletePushSubscription({ data: { endpoint } });
    } catch {
      // best-effort; server prune will remove stale endpoints on 404/410
    }
  }
}