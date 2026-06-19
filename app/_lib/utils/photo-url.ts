/**
 * Convert a stored photo path (e.g. "/uploads/photos/566-v1-thumb.jpg") into
 * the API route that streams it from disk ("/api/photos/566-v1-thumb.jpg").
 *
 * Serving via the route avoids Next.js standalone caching the public/ dir at
 * startup, which makes freshly uploaded files 404 until the server restarts.
 */
export function photoSrc(storedPath: string): string {
  const name = storedPath.split("/").pop() ?? "";
  return `/api/photos/${name}`;
}
