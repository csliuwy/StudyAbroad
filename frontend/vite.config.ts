import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    /** Dedicated port so this app does not share 5173 with other local Vite projects (Windows may allow duplicate binds → empty / wrong page). */
    port: 5180,
    strictPort: true
  }
});
