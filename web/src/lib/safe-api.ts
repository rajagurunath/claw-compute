import { ApiError, api } from "./api";

/**
 * Wrap a fetch for a public endpoint that should fall back to a seed value
 * if the API is unreachable or returns 5xx. NEVER use this on authed endpoints
 * — those must fail closed.
 *
 * On 4xx (other than 404 → fallback for missing resources) the original error
 * propagates so callers can decide (e.g. notFound(), redirect, etc.).
 */
export async function safeGet<T>(
  path: string,
  fallback: T,
  options: {
    fallbackOn4xx?: boolean;
    label?: string;
  } = {},
): Promise<T> {
  try {
    return await api.get<T>(path, { auth: false });
  } catch (e) {
    if (e instanceof ApiError) {
      if (options.fallbackOn4xx === false && e.status < 500) {
        throw e;
      }
      if (e.status >= 500 || options.fallbackOn4xx) {
        console.warn(
          `[safeGet] API ${e.status} on ${options.label ?? path} — using seed fallback`,
        );
        return fallback;
      }
      throw e;
    }
    // Network error / timeout / no API URL configured.
    console.warn(
      `[safeGet] API unreachable for ${options.label ?? path} — using seed fallback (${e instanceof Error ? e.message : "unknown"})`,
    );
    return fallback;
  }
}

export const isApiConfigured = (): boolean => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  return !!url && !url.includes("localhost") ? true : !!url;
};
