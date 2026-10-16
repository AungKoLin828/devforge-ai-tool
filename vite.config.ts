import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build the React client from frontend/ into the deployment's static output folder.
export default defineConfig({
  plugins: [react()],
  root: "frontend",
  build: { outDir: "dist", emptyOutDir: true },
});
