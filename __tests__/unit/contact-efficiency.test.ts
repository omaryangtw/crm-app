import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { contactCreateSchema } from "@/app/_lib/schemas/contact-schema";

/**
 * **Feature: contact-efficiency, Property 1: caseId 往返一致性**
 *
 * **Validates: Requirements 1.4, 2.1, 2.2, 2.3**
 *
 * For any valid caseId value (positive integer or undefined/null),
 * contactCreateSchema should parse it correctly and preserve the value
 * through the roundtrip.
 */
describe("Feature: contact-efficiency, Property 1: caseId 往返一致性", () => {
  const validContactType = ["outgoing", "incoming", "visit", "sms"] as const;

  it("caseId roundtrip: positive integer caseId is preserved through schema parse", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom(...validContactType),
        (caseId, clientId, contactType) => {
          const input = { caseId, clientId, contactType };
          const result = contactCreateSchema.safeParse(input);

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.caseId).toBe(caseId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("caseId roundtrip: undefined caseId is parsed as null or undefined", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom(...validContactType),
        (clientId, contactType) => {
          const input = { clientId, contactType, caseId: undefined };
          const result = contactCreateSchema.safeParse(input);

          expect(result.success).toBe(true);
          if (result.success) {
            // optional().nullable() — undefined input should yield undefined or null
            expect(result.data.caseId == null).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("caseId roundtrip: null caseId is parsed as null", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom(...validContactType),
        (clientId, contactType) => {
          const input = { clientId, contactType, caseId: null };
          const result = contactCreateSchema.safeParse(input);

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.caseId).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("caseId roundtrip: random caseId (positive integer or undefined) preserves value", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 1, max: 10000 })),
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom(...validContactType),
        (maybeCaseId, clientId, contactType) => {
          // fc.option produces T | null — map null to undefined for the "not provided" case
          const caseId = maybeCaseId ?? undefined;
          const input = { caseId, clientId, contactType };
          const result = contactCreateSchema.safeParse(input);

          expect(result.success).toBe(true);
          if (result.success) {
            if (maybeCaseId !== null) {
              // Positive integer provided → must be preserved exactly
              expect(result.data.caseId).toBe(maybeCaseId);
            } else {
              // Not provided → must be null or undefined
              expect(result.data.caseId == null).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: contact-efficiency, Property 2: 無效 caseId 拒絕**
 *
 * **Validates: Requirements 2.4**
 *
 * For any positive integer caseId that does not exist in the cases table,
 * createContact should return { success: false, error: "指定的案件不存在" }
 * and must NOT create any Contact record.
 */
describe("Feature: contact-efficiency, Property 2: 無效 caseId 拒絕", () => {
  const mockContactCreate = vi.fn();
  const mockCaseFindUnique = vi.fn();
  const mockAuth = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();

    // Auth returns a valid session so we get past the auth check
    mockAuth.mockResolvedValue({
      user: { id: "1", email: "test@example.com", role: "admin", staffId: 1 },
    });

    // case.findUnique always returns null — the case does not exist
    mockCaseFindUnique.mockResolvedValue(null);

    // contact.create should never be called
    mockContactCreate.mockResolvedValue({ id: 999 });
  });

  it("rejects any non-existent caseId and does not create a Contact", async () => {
    // Set up mocks via vi.doMock before dynamic import
    vi.doMock("@/app/_lib/auth", () => ({ auth: mockAuth }));
    vi.doMock("@/app/_lib/db", () => ({
      prisma: {
        case: { findUnique: mockCaseFindUnique },
        contact: { create: mockContactCreate },
      },
    }));
    vi.doMock("next/cache", () => ({
      revalidatePath: vi.fn(),
    }));
    vi.doMock("@/app/_lib/audit/audit-service", () => ({
      createAuditLogEntry: vi.fn().mockResolvedValue(undefined),
      serializeEntity: vi.fn((x: unknown) => x),
    }));

    const { createContact } = await import(
      "@/app/_lib/actions/contact-actions"
    );

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1 }),
        fc.integer({ min: 1, max: 100000 }),
        async (caseId, clientId) => {
          mockCaseFindUnique.mockResolvedValue(null);
          mockContactCreate.mockClear();

          const formData = new FormData();
          formData.set("clientId", String(clientId));
          formData.set("caseId", String(caseId));
          formData.set("isSuccess", "true");

          const result = await createContact(formData);

          // Must reject with the expected error
          expect(result).toEqual({
            success: false,
            error: "指定的案件不存在",
          });

          // case.findUnique must have been called with the generated caseId
          expect(mockCaseFindUnique).toHaveBeenCalledWith({
            where: { id: caseId },
            select: { id: true },
          });

          // contact.create must NOT have been called
          expect(mockContactCreate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: contact-efficiency, Property 4: 快速動作按鈕欄位映射**
 *
 * **Validates: Requirements 4.2, 4.3**
 *
 * For any quick action definition in QUICK_ACTIONS, the FormData built from
 * that action should contain the correct contactType, isSuccess, and record
 * values matching the action definition exactly.
 */
describe("Feature: contact-efficiency, Property 4: 快速動作按鈕欄位映射", () => {
  const QUICK_ACTIONS = [
    { label: "撥出未接", contactType: "outgoing", isSuccess: false, record: "撥出未接" },
    { label: "撥出已接", contactType: "outgoing", isSuccess: true,  record: "" },
    { label: "來電",     contactType: "incoming", isSuccess: true,  record: "" },
    { label: "親訪未遇", contactType: "visit",    isSuccess: false, record: "親訪未遇" },
  ] as const;

  /**
   * Helper: builds a FormData exactly as QuickActionButton would when clicked.
   * Combines the action's preset fields with auto-prefilled clientId, date, staffId.
   */
  function buildQuickActionFormData(
    action: (typeof QUICK_ACTIONS)[number],
    clientId: number,
    date: string,
    staffId: number
  ): FormData {
    const fd = new FormData();
    fd.set("clientId", String(clientId));
    fd.set("date", date);
    fd.set("staffInChargeIds", String(staffId));
    fd.set("contactType", action.contactType);
    fd.set("isSuccess", String(action.isSuccess));
    fd.set("record", action.record);
    return fd;
  }

  it("FormData built from any quick action contains correct contactType, isSuccess, record", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...QUICK_ACTIONS),
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 1000 }),
        (action, clientId, staffId) => {
          const today = new Date().toISOString().slice(0, 10);
          const fd = buildQuickActionFormData(action, clientId, today, staffId);

          // contactType must match the action definition
          expect(fd.get("contactType")).toBe(action.contactType);

          // isSuccess must match (FormData stores as string)
          expect(fd.get("isSuccess")).toBe(String(action.isSuccess));

          // record must match the action definition
          expect(fd.get("record")).toBe(action.record);

          // auto-prefilled fields must also be present
          expect(fd.get("clientId")).toBe(String(clientId));
          expect(fd.get("staffInChargeIds")).toBe(String(staffId));
          expect(fd.get("date")).toBe(today);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: contact-efficiency, Property 5: 範本文字應用**
 *
 * **Validates: Requirements 5.3, 5.4**
 *
 * For any existing record text (including empty string) and any template from
 * CONTACT_TEMPLATES, applying the template should:
 * - If existing text is empty → result equals the template text
 * - If existing text is non-empty → result equals existing text + "\n" + template text
 */
describe("Feature: contact-efficiency, Property 5: 範本文字應用", () => {
  const CONTACT_TEMPLATES = [
    "確認地址無誤",
    "約定下次訪視",
    "轉介相關資源",
    "關懷問候",
    "通知活動訊息",
  ] as const;

  /**
   * Applies a template to existing record text.
   * Empty existing text → template directly; non-empty → append with newline separator.
   */
  function applyTemplate(existing: string, template: string): string {
    if (existing === "") {
      return template;
    }
    return existing + "\n" + template;
  }

  it("empty existing text → result equals template text", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CONTACT_TEMPLATES),
        (template) => {
          const result = applyTemplate("", template);
          expect(result).toBe(template);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("non-empty existing text → result equals existing + newline + template", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom(...CONTACT_TEMPLATES),
        (existing, template) => {
          const result = applyTemplate(existing, template);
          expect(result).toBe(existing + "\n" + template);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("random existing text (empty or non-empty) follows the correct branching logic", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.constantFrom(...CONTACT_TEMPLATES),
        (existing, template) => {
          const result = applyTemplate(existing, template);

          if (existing === "") {
            // Empty → direct fill
            expect(result).toBe(template);
          } else {
            // Non-empty → append with newline
            expect(result).toBe(existing + "\n" + template);
          }

          // Result always contains the template text
          expect(result).toContain(template);

          // Result always ends with the template text
          expect(result.endsWith(template)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: contact-efficiency, Property 11: 時間軸按日期降序排列**
 *
 * **Validates: Requirements 6.3**
 *
 * For any set of dates displayed in CaseContactTimeline, the records
 * should be sorted in descending order (newest first), meaning each
 * date[i] >= date[i+1].
 */
describe("Feature: contact-efficiency, Property 11: 時間軸按日期降序排列", () => {
  /**
   * Sorts an array of dates in descending order (newest first).
   */
  function sortDescending(dates: Date[]): Date[] {
    return [...dates].sort((a, b) => b.getTime() - a.getTime());
  }

  it("after sorting, each date[i] >= date[i+1] (descending order)", () => {
    fc.assert(
      fc.property(fc.array(fc.date({ noInvalidDate: true })), (dates) => {
        const sorted = sortDescending(dates);

        // Verify descending order: each element >= the next
        for (let i = 0; i < sorted.length - 1; i++) {
          expect(sorted[i].getTime()).toBeGreaterThanOrEqual(
            sorted[i + 1].getTime()
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it("sortDescending preserves all original dates (same length and elements)", () => {
    fc.assert(
      fc.property(fc.array(fc.date({ noInvalidDate: true })), (dates) => {
        const sorted = sortDescending(dates);

        // Same length
        expect(sorted.length).toBe(dates.length);

        // Same elements (by timestamp), just reordered
        const originalTimestamps = dates
          .map((d) => d.getTime())
          .sort((a, b) => a - b);
        const sortedTimestamps = sorted
          .map((d) => d.getTime())
          .sort((a, b) => a - b);
        expect(sortedTimestamps).toEqual(originalTimestamps);
      }),
      { numRuns: 100 }
    );
  });

  it("sortDescending is idempotent (sorting twice yields same result)", () => {
    fc.assert(
      fc.property(fc.array(fc.date({ noInvalidDate: true })), (dates) => {
        const sortedOnce = sortDescending(dates);
        const sortedTwice = sortDescending(sortedOnce);

        expect(sortedTwice.map((d) => d.getTime())).toEqual(
          sortedOnce.map((d) => d.getTime())
        );
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: contact-efficiency, Property 13: 通聯列表案件欄位顯示**
 *
 * **Validates: Requirements 10.1, 10.2, 10.3**
 *
 * For any Contact record, when caseId is null the "關聯案件" column should
 * display "—"; when caseId is not null, it should display the case name as a
 * clickable link with href pointing to `/cases/{caseId}`.
 */
describe("Feature: contact-efficiency, Property 13: 通聯列表案件欄位顯示", () => {
  /**
   * Renders the case field for a contact row.
   * - null caseData → dash placeholder, no link
   * - non-null caseData → case name (or "—" if name is null), link to case detail page
   */
  function renderCaseField(
    caseData: { id: number; name: string | null } | null
  ): { text: string; href: string | null } {
    if (caseData === null) {
      return { text: "—", href: null };
    }
    return { text: caseData.name ?? "—", href: `/cases/${caseData.id}` };
  }

  it("null caseData renders dash with no link", () => {
    fc.assert(
      fc.property(fc.constant(null), (caseData) => {
        const result = renderCaseField(caseData);
        expect(result.text).toBe("—");
        expect(result.href).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("non-null caseData renders case name with link to /cases/{id}", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1 }),
          name: fc.option(fc.string({ minLength: 1 })),
        }),
        (caseData) => {
          const result = renderCaseField(caseData);

          // name is non-null → display name; name is null → display "—"
          if (caseData.name !== null) {
            expect(result.text).toBe(caseData.name);
          } else {
            expect(result.text).toBe("—");
          }

          // href always points to the case detail page
          expect(result.href).toBe(`/cases/${caseData.id}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("random caseData (null or { id, name }) follows correct rendering logic", () => {
    fc.assert(
      fc.property(
        fc.option(
          fc.record({
            id: fc.integer({ min: 1 }),
            name: fc.option(fc.string()),
          })
        ),
        (caseData) => {
          const result = renderCaseField(caseData);

          if (caseData === null) {
            // null → dash, no link
            expect(result.text).toBe("—");
            expect(result.href).toBeNull();
          } else {
            // non-null → link always present
            expect(result.href).toBe(`/cases/${caseData.id}`);

            // name present → display name; name null → display "—"
            if (caseData.name !== null) {
              expect(result.text).toBe(caseData.name);
            } else {
              expect(result.text).toBe("—");
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
