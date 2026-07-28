import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.arsenengabo.versewarship",
  appName: "Verse Warship",
  // IMPORTANT: replace with your real deployed URL (Lovable/Cloudflare production domain).
  // This project builds with Nitro/SSR (see .output/server), so it is NOT a static
  // site Capacitor can bundle locally — it must point at the live server, same as
  // any other WebView-based wrapper of a server-rendered app.
  webDir: "www-placeholder", // required by Capacitor CLI but unused when server.url is set
  server: {
    url: "https://worshipverse.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
