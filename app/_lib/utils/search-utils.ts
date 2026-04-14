/** Build detail-page href for a given entity type and ID. */
export function buildEntityHref(entityType: string, entityId: number): string {
  switch (entityType) {
    case "Client":
      return `/clients/${entityId}`;
    case "Case":
      return `/cases/${entityId}`;
    case "Contact":
      return `/contacts/${entityId}`;
    default:
      return "#";
  }
}

/** Mask an IDN string: keep first and last char, replace middle with '*'. */
export function maskIdn(idn: string | null | undefined): string {
  if (!idn || idn.length <= 2) return idn ?? "—";
  return idn[0] + "*".repeat(idn.length - 2) + idn[idn.length - 1];
}

/** Truncate text to maxLength, appending "..." if exceeded. */
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/** Format a Date as relative time in Traditional Chinese. */
export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${minutes} 分鐘前`;
  if (hours < 24) return `${hours} 小時前`;
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString("zh-TW");
}

/** Format a tab label with count: "label (count)". */
export function formatTabLabel(label: string, count: number): string {
  return `${label} (${count})`;
}

/** Extract a human-readable entity name from audit log data. */
export function extractEntityName(
  entityType: string,
  data: Record<string, unknown> | null,
): string {
  if (!data) return "(未知)";
  switch (entityType) {
    case "Client":
      return (data.name as string) ?? "(未命名)";
    case "Case":
      return (data.name as string) ?? "(未命名案件)";
    case "Contact":
      return (data.record as string)?.slice(0, 30) ?? "(無紀錄)";
    default:
      return "(未知)";
  }
}
