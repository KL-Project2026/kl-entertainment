const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function getApiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
