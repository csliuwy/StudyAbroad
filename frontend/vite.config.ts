import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  /** Deployed at domain root; keeps asset URLs stable (`/brand/...`, `/data/...`). */
  base: "/",
  server: {
    /** Dedicated port so this app does not share 5173 with other local Vite projects (Windows may allow duplicate binds → empty / wrong page). */
    port: 5180,
    strictPort: true,
    /** Allow access via LAN / hostname (e.g. studyabroad.martxdata.com pointing at this machine). */
    host: true,
    /** Dev behind Nginx on 80/443: accept `Host` from reverse proxy (Vite 5 host check). */
    allowedHosts: true
  }
});
