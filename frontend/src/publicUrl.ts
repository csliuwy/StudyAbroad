/**
 * URL for files copied from `public/` into `dist/` (Vite).
 * Always root-absolute when `base` is `/`, so assets work on deep routes like `/projects/...`.
 */
export function publicUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = import.meta.env.BASE_URL ?? "/";
  if (base === "/" || base === "") {
    return normalized;
  }
  return `${String(base).replace(/\/+$/, "")}${normalized}`;
}
