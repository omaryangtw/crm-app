import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock("@/app/_lib/db", () => ({
  prisma: {
    auditLog: {
      create: mockCreate,
    },
  },
}));

import {
  createAuditLogEntry,
  computeChangedFields,
  serializeEntity,
} from "@/app/_lib/audit/audit-service";
import type { CreateAuditLogParams } from "@/app/_lib/audit/audit-types";

describe("createAuditLogEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams: CreateAuditLogParams = {
    entityType: "Client",
    entityId: 1,
    action: "CREATE",
    userId: 10,
    userEmail: "user@example.com",
    oldData: null,
    newData: { name: "Alice", age: 30 },
    changedFields: [],
  };

  it("calls prisma.auditLog.create with correct data for CREATE action", async () => {
    mockCreate.mockResolvedValue({});
    await createAuditLogEntry(baseParams);

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        entityType: "Client",
        entityId: 1,
        action: "CREATE",
        userId: 10,
        userEmail: "user@example.com",
        oldData: undefined,
        newData: { name: "Alice", age: 30 },
        changedFields: [],
      },
    });
  });

  it("sets changedFields to [] for CREATE action", async () => {
    mockCreate.mockResolvedValue({});
    await createAuditLogEntry(baseParams);

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.changedFields).toEqual([]);
  });

  it("sets changedFields to [] for DELETE action", async () => {
    mockCreate.mockResolvedValue({});
    await createAuditLogEntry({
      ...baseParams,
      action: "DELETE",
      oldData: { name: "Alice" },
      newData: null,
    });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.changedFields).toEqual([]);
  });

  it("computes changedFields via computeChangedFields for UPDATE action", async () => {
    mockCreate.mockResolvedValue({});
    const oldData = { name: "Alice", age: 30, city: "Taipei" };
    const newData = { name: "Bob", age: 30, city: "Taipei" };

    await createAuditLogEntry({
      ...baseParams,
      action: "UPDATE",
      oldData,
      newData,
    });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.changedFields).toEqual(["name"]);
  });

  it("catches errors and logs to console.error without throwing", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockRejectedValue(new Error("DB connection failed"));

    await expect(createAuditLogEntry(baseParams)).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to create audit log entry",
      expect.objectContaining({
        entityType: "Client",
        entityId: 1,
        action: "CREATE",
        userId: 10,
      })
    );
    consoleSpy.mockRestore();
  });
});

describe("audit-service module immutability", () => {
  it("does not export any update or delete functions", async () => {
    const auditService = await import("@/app/_lib/audit/audit-service");
    const exportedNames = Object.keys(auditService);

    for (const name of exportedNames) {
      const lower = name.toLowerCase();
      expect(lower).not.toContain("update");
      expect(lower).not.toContain("delete");
      expect(lower).not.toContain("remove");
    }
  });
});
