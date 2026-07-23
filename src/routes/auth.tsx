import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Account — Verse" },
      { name: "description", content: "Sign in to Verse to sync favorites and settings across your devices." },
      { property: "og:title", content: "Account — Verse" },
      { property: "og:description", content: "Sync your Verse across every device." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    router.invalidate();
    toast("Signed out");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Google sign-in failed.");
      }
    } catch {
      toast.error("Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-md px-4 pt-16 text-muted-foreground">Loading…</div>;
  }

  if (user) {
    return (
      <div className="mx-auto max-w-md px-4 pb-32 pt-12">
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">Signed in as <strong className="text-foreground">{user.email}</strong>.</p>
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Your favorites now sync to this account. Sign out at any time and your local
            favorites will stay on this device.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-secondary px-5 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-32 pt-12">
      <h1 className="text-3xl font-bold tracking-tight">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to sync favorites and settings across every device.
      </p>

      <button
        type="button"
        onClick={google}
        disabled={busy}
        className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-medium transition hover:bg-secondary disabled:opacity-60"
      >
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-muted-foreground">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Password</span>
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {mode === "signup"
          ? "Have an account? Sign in"
          : "New to Verse? Create an account"}
      </button>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        You can also use Verse as a guest — favorites are saved on this device.
      </p>
    </div>
  );
}