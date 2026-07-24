import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // registerType: "prompt" (was "autoUpdate") + injectRegister: null --
    // "autoUpdate" silently activates a new service worker and reloads
    // the page out from under whatever the person is doing, including
    // mid-workout. We register the SW ourselves (App.jsx, via
    // virtual:pwa-register) so a new version surfaces as an in-app
    // notice instead, and — per product requirement — only ever shows
    // it while no workout is active, since a mid-workout reload should
    // never be forced, even a well-intentioned one. injectRegister:
    // null stops the plugin from also auto-injecting its own default
    // registration script, which would otherwise register the SW a
    // second time outside our control.
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "DeltaLog",
        short_name: "DeltaLog",
        description: "Log sets, track load, hit the target.",
        theme_color: "#101216",
        background_color: "#101216",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // Precache the app shell so it opens even with zero signal at the gym.
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        // cleanupOutdatedCaches: once a new service worker activates,
        // delete any precache storage left over from older versions --
        // without this, stale cache entries from several deploys back
        // can accumulate and, in rare cases, get served instead of the
        // current version. clientsClaim: once an update IS applied
        // (still only ever via the explicit "Reload now" flow -- this
        // doesn't change when that happens, see App.jsx's showUpdateNotice
        // gating), the new worker takes control of every open tab
        // immediately rather than requiring yet another navigation.
        // navigateFallback: explicit, so any navigation request always
        // resolves to the precached app shell rather than depending on
        // generateSW's default inference.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: "/index.html"
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1500
  }
});
