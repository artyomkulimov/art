import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://art.artyomkulimov.com",
  output: "static",
  devToolbar: { enabled: false },
  prefetch: true,
  build: { inlineStylesheets: "always" },
  adapter: vercel(),
  // Let the dev server be opened from other machines on the tailnet.
  vite: { server: { allowedHosts: ["stus", ".ts.net"] } },
});
