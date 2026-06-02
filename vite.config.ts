import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { envOnlyMacros } from "vite-env-only";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 3000,
  },
  plugins: [tsConfigPaths(), tailwindcss(), envOnlyMacros(), tanstackStart(), viteReact()],
});
