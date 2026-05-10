import { getToken } from "./session";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = { auth: true },
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth) {
    const token = await getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  // ngrok-free returns an HTML interstitial for browser-like User-Agents.
  // Vercel's server-side fetch sometimes uses such a UA, which breaks
  // downstream res.json(). This header is the documented ngrok bypass.
  headers.set("ngrok-skip-browser-warning", "1");
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "claw-marketplace-frontend/0.1");
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: { auth?: boolean }) => request<T>(path, { method: "GET" }, opts),
  post: <T>(path: string, body: unknown, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, opts),
  patch: <T>(path: string, body: unknown, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, opts),
  del: <T>(path: string, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "DELETE" }, opts),
};
