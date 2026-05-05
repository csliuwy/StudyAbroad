/**
 * REST API base URL (no trailing slash).
 * - `VITE_API_BASE_URL` wins when set (e.g. https://studyabroad.martxdata.com/api).
 * - Dev: same host as the page, port 8080 (works for localhost and LAN/domain).
 * - Prod build: same-origin `/api` (use reverse proxy to backend).
 */
export function resolveApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().replace(/\/+$/, "");
  }
  if (import.meta.env.DEV) {
    if (typeof window !== "undefined") {
      const { protocol, hostname, port } = window.location;
      // Nginx (or similar) on 80/443: same-origin /api is proxied to the backend.
      const p = port || (protocol === "https:" ? "443" : "80");
      if (p === "80" || p === "443") {
        return `${window.location.origin}/api`.replace(/\/+$/, "");
      }
      return `${protocol}//${hostname}:8080/api`;
    }
    return "http://localhost:8080/api";
  }
  return "/api";
}
