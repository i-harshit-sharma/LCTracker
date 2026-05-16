import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT || "5173";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH || "/";

// Explicitly type the plugins array
const plugins: PluginOption[] = [
  react(),
  tailwindcss({ optimize: false }),
  runtimeErrorOverlay(),
];

// Use top-level await for dynamic imports (supported in type: module)
if (
  process.env.NODE_ENV !== "production" &&
  process.env.REPL_ID !== undefined
) {
  const { cartographer } = await import("@replit/vite-plugin-cartographer");
  const { devBanner } = await import("@replit/vite-plugin-dev-banner");

  plugins.push(
    cartographer({
      root: path.resolve(import.meta.dirname, ".."),
    }),
    devBanner(),
  );
}

// Only load the prerenderer if we're not running tests
if (!process.env.VITEST) {
  try {
    const { default: vitePrerender } = await import("vite-plugin-prerender");
    plugins.push(
      vitePrerender({
        staticDir: path.join(import.meta.dirname, "dist/public"),
        routes: ["/"],
      }),
    );
  } catch (e) {
    console.warn("Prerenderer could not be loaded:", e);
  }
}

export default defineConfig({
  base: basePath,
  define: {
    "process.env.APP_VERSION": JSON.stringify(
      process.env.npm_package_version || "0.0.0",
    ),
  },
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
