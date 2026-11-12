import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build the React client from apps/web/ into the deployment's static output folder.
export default defineConfig({
  plugins: [react()],
  root: "apps/web",
  build: { outDir: "dist", emptyOutDir: true },
});
