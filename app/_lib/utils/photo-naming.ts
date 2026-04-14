const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function computeNextVersion(existingVersions: number[]): number {
  return Math.max(...existingVersions, 0) + 1;
}

export function getPhotoFilenames(
  clientId: number,
  version: number,
  originalMimeType: string
): { thumbnailFilename: string; originalFilename: string } {
  const ext = MIME_TO_EXT[originalMimeType] ?? ".jpg";

  return {
    thumbnailFilename: `${clientId}-v${version}-thumb.jpg`,
    originalFilename: `${clientId}-v${version}-original${ext}`,
  };
}
