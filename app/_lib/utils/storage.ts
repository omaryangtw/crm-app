/**
 * Safe localStorage wrappers that handle SSR, JSON parse errors,
 * and storage quota exceeded — all silently.
 */

/**
 * Read and JSON-parse a value from localStorage.
 * Returns null when running on the server, when the key is missing,
 * or when the stored string is not valid JSON.
 */
export function safeGetItem<T = unknown>(key: string): T | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * JSON-stringify a value and write it to localStorage.
 * Silently ignores failures (SSR, quota exceeded, circular refs, etc.).
 */
export function safeSetItem(key: string, value: unknown): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // intentionally swallowed
  }
}

/**
 * Remove a key from localStorage.
 * Silently ignores failures.
 */
export function safeRemoveItem(key: string): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  } catch {
    // intentionally swallowed
  }
}
