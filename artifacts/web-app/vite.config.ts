import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// MIGRATION: env-based PORT/BASE_PATH — Replit throws on missing vars; Vercel/local uses defaults
const rawPort = process.env.PORT;
const port = rawPort && !Number.isNaN(Number(rawPort)) && Number(rawPort) > 0
  ? Number(rawPort)
  : 5173;

const basePath = process.env.BASE_PATH ?? "/";

// MIGRATION: Replit-specific behavior preserved via env guard — lazy load only when REPL_ID present
const isReplit = process.env.REPL_ID !== undefined;
const replitPlugins = isReplit && process.env.NODE_ENV !== "production"
  ? await Promise.all([
      import("@replit/vite-plugin-runtime-error-modal").then(m => m.default()).catch(() => null),
      import("@replit/vite-plugin-cartographer").then(m =>
        m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
      ).catch(() => null),
      import("@replit/vite-plugin-dev-banner").then(m => m.devBanner()).catch(() => null),
    ]).then(plugins => plugins.filter(Boolean))
  : [];

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...replitPlugins,
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
