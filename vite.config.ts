import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import autoprefixerPlugin from "autoprefixer";
import tailwindcssPlugin from "tailwindcss";

export default defineConfig(() => ({
  base: "",
  build: {
    outDir: "../../.ntli/site/static/ui",
    // Vite 8's default lightningcss minifier rejects an unescaped SVG data-URL
    // in @netlify/sdk's ui-react stylesheet.
    cssMinify: "esbuild" as const,
  },
  root: "./src/ui",
  plugins: [react()],
  server: {
    strictPort: true,
  },
  css: {
    devSourcemap: true,
    postcss: {
      plugins: [autoprefixerPlugin, tailwindcssPlugin],
    },
  },
}));
