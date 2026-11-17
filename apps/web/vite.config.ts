import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // ADR-005, ФБШ-15: утсанд суулгах PWA. Апп-ын бүрхүүл precache хийгдэж, багшийн өнөөдрийн
    // хичээл, ирцийн жагсаалт 24 цаг төхөөрөмжид хадгалагдана (сүлжээ тасрахад ирц бүртгэх).
    // push-sw.js (Web Push) нь үүсгэгдсэн service worker-т importScripts-ээр орно.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Пи тоо",
        short_name: "Пи тоо",
        description: "Математикийн сургалтын төвийн удирдлагын систем",
        lang: "mn",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#8b1a1a",
        background_color: "#f8f4f0",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        importScripts: ["push-sw.js"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            // Зөвхөн хичээлийн жагсаалт ба ирцийн жагсаалт (GET). Гарахад цэвэрлэгдэнэ.
            urlPattern: ({ url, request }) =>
              request.method === "GET" && /^\/api\/v1\/lessons(\/|$)/.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-lessons",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
      },
      // ФШ-78: багш, салбарын оруулсан зураг API серверээс.
      "/uploads": {
        target: process.env.VITE_API_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
