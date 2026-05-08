/**
 * System constants.
 *
 * PLACEHOLDER_CLIENT_ID: The id=0 "unknown" client used as a placeholder
 * for orphan cases/contacts. Should be excluded from user-facing queries.
 */
export const PLACEHOLDER_CLIENT_ID = 0;

/** Prisma where clause to exclude the placeholder client */
export const EXCLUDE_PLACEHOLDER = { id: { not: PLACEHOLDER_CLIENT_ID } } as const;
