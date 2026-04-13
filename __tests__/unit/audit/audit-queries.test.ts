import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock("@/app/_lib/db", () => ({
  prisma: {
    auditLog: {
      findMany: mockFindMany,
    },
  },
}));

import { getAuditLogs } from "@/app/_lib/audit/audit-queries";

function makeEntry(id: number) {
  return {
    id,
    entityType: "Client",
    entityId: 1,
    action: "UPDATE",
    userId: 10,
    userEmail: "user@example.com",
    oldData: {},
    newData: {},
    changedFields: ["name"],
    createdAt: new Date(),
  };
}

describe("getAuditLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty list when no entries exist", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await getAuditLogs({ entityType: "Client", entityId: 99 });

    expect(result.entries).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("queries with correct where and orderBy", async () => {
    mockFindMany.mockResolvedValue([]);

    await getAuditLogs({ entityType: "Case", entityId: 5 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: "Case", entityId: 5 },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("uses default pageSize of 20", async () => {
    mockFindMany.mockResolvedValue([]);

    await getAuditLogs({ entityType: "Client", entityId: 1 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 21 })
    );
  });

  it("uses custom pageSize when provided", async () => {
    mockFindMany.mockResolvedValue([]);

    await getAuditLogs({ entityType: "Client", entityId: 1, pageSize: 5 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 6 })
    );
  });

  it("applies cursor and skip when cursor is provided", async () => {
    mockFindMany.mockResolvedValue([]);

    await getAuditLogs({ entityType: "Client", entityId: 1, cursor: 42 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 42 },
        skip: 1,
      })
    );
  });

  it("returns nextCursor as null when fewer entries than pageSize", async () => {
    const entries = [makeEntry(3), makeEntry(2)];
    mockFindMany.mockResolvedValue(entries);

    const result = await getAuditLogs({
      entityType: "Client",
      entityId: 1,
      pageSize: 5,
    });

    expect(result.entries).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it("returns nextCursor when more entries exist", async () => {
    // pageSize=2, so we request 3 — return 3 means there's a next page
    const entries = [makeEntry(10), makeEntry(9), makeEntry(8)];
    mockFindMany.mockResolvedValue(entries);

    const result = await getAuditLogs({
      entityType: "Client",
      entityId: 1,
      pageSize: 2,
    });

    expect(result.entries).toHaveLength(2);
    expect(result.nextCursor).toBe(9);
  });
});
