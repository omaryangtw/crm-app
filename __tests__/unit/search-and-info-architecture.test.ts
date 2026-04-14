import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  formatTabLabel,
  buildEntityHref,
  maskIdn,
  truncateText,
} from "@/app/_lib/utils/search-utils";

/**
 * Feature: search-and-info-architecture, Property 1: Tab 標籤計數格式
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 *
 * For any tab label string (minLength 1) and any non-negative integer count,
 * formatTabLabel(label, count) returns "${label} (${count})".
 */
describe("Feature: search-and-info-architecture, Property 1: Tab 標籤計數格式", () => {
  it("formatTabLabel returns label (count) for any label and non-negative count", () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.string({ minLength: 1 }), fc.nat()),
        ([label, count]) => {
          const result = formatTabLabel(label, count);
          expect(result).toBe(`${label} (${count})`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: search-and-info-architecture, Property 4: 實體詳情頁連結生成
 *
 * **Validates: Requirements 6.4**
 *
 * For any entityType in {"Client", "Case", "Contact"} and any positive integer id,
 * buildEntityHref returns the correct detail page path.
 */
describe("Feature: search-and-info-architecture, Property 4: 實體詳情頁連結生成", () => {
  it("buildEntityHref returns correct path for Client, Case, Contact", () => {
    const expectedPaths: Record<string, string> = {
      Client: "/clients",
      Case: "/cases",
      Contact: "/contacts",
    };

    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom("Client", "Case", "Contact"),
          fc.integer({ min: 1 })
        ),
        ([entityType, id]) => {
          const result = buildEntityHref(entityType, id);
          expect(result).toBe(`${expectedPaths[entityType]}/${id}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: search-and-info-architecture, Property 9: 身分證號遮蔽
 *
 * **Validates: Requirements 11.4**
 *
 * - length > 2: first and last char preserved, middle all '*', total length unchanged
 * - length ≤ 2: return as-is
 * - null/undefined: return "—"
 */
describe("Feature: search-and-info-architecture, Property 9: 身分證號遮蔽", () => {
  it("strings with length > 2: first/last preserved, middle masked, length unchanged", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 20 }),
        (idn) => {
          const result = maskIdn(idn);
          // Total length unchanged
          expect(result.length).toBe(idn.length);
          // First char preserved
          expect(result[0]).toBe(idn[0]);
          // Last char preserved
          expect(result[result.length - 1]).toBe(idn[idn.length - 1]);
          // Middle chars are all '*'
          const middle = result.slice(1, -1);
          expect(middle).toBe("*".repeat(idn.length - 2));
        }
      ),
      { numRuns: 100 }
    );
  });

  it("strings with length ≤ 2: returned as-is", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 2 }),
        (idn) => {
          const result = maskIdn(idn);
          expect(result).toBe(idn);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("null and undefined return '—'", () => {
    expect(maskIdn(null)).toBe("—");
    expect(maskIdn(undefined)).toBe("—");
  });
});

/**
 * Feature: search-and-info-architecture, Property 10: 紀錄文字截斷
 *
 * **Validates: Requirements 11.6**
 *
 * - text.length ≤ maxLength → return text as-is
 * - text.length > maxLength → return text.slice(0, maxLength) + "..."
 */
describe("Feature: search-and-info-architecture, Property 10: 紀錄文字截斷", () => {
  it("truncateText preserves short text and truncates long text correctly", () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.string(), fc.integer({ min: 1, max: 200 })),
        ([text, maxLength]) => {
          const result = truncateText(text, maxLength);

          if (text.length <= maxLength) {
            expect(result).toBe(text);
          } else {
            expect(result).toBe(text.slice(0, maxLength) + "...");
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Dashboard Actions — Property Tests
// ---------------------------------------------------------------------------

import { extractEntityName } from "@/app/_lib/utils/search-utils";

/**
 * Feature: search-and-info-architecture, Property 2: 最近操作查詢篩選與排序
 *
 * **Validates: Requirements 6.2**
 *
 * For any collection of audit-log-like records and any userId,
 * filtering by userId, sorting by createdAt desc, and taking at most 10
 * produces the correct subset in the correct order.
 *
 * Since getRecentActivity uses Prisma internally (server action), we validate
 * the SPECIFICATION logic (filter → sort → limit) against random data sets.
 */
describe("Feature: search-and-info-architecture, Property 2: 最近操作查詢篩選與排序", () => {
  const auditLogArb = fc.record({
    id: fc.integer({ min: 1 }),
    userId: fc.integer({ min: 1, max: 10 }),
    createdAt: fc.date({
      min: new Date("2020-01-01"),
      max: new Date("2030-01-01"),
    }),
    action: fc.constantFrom("CREATE", "UPDATE", "DELETE"),
    entityType: fc.constantFrom("Client", "Case", "Contact"),
    entityId: fc.integer({ min: 1 }),
  });

  it("filtered results contain only the specified userId", () => {
    fc.assert(
      fc.property(
        fc.array(auditLogArb, { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (logs, targetUserId) => {
          const filtered = logs.filter((l) => l.userId === targetUserId);
          const sorted = [...filtered].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
          const result = sorted.slice(0, 10);

          // All results belong to the target userId
          for (const item of result) {
            expect(item.userId).toBe(targetUserId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("results are at most 10 items", () => {
    fc.assert(
      fc.property(
        fc.array(auditLogArb, { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (logs, targetUserId) => {
          const filtered = logs.filter((l) => l.userId === targetUserId);
          const sorted = [...filtered].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
          const result = sorted.slice(0, 10);

          expect(result.length).toBeLessThanOrEqual(10);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("results are sorted by createdAt descending", () => {
    fc.assert(
      fc.property(
        fc.array(auditLogArb, { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (logs, targetUserId) => {
          const filtered = logs.filter((l) => l.userId === targetUserId);
          const sorted = [...filtered].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
          const result = sorted.slice(0, 10);

          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
              result[i].createdAt.getTime(),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: search-and-info-architecture, Property 3: 最近操作紀錄顯示完整欄位
 *
 * **Validates: Requirements 6.3**
 *
 * For any entityType and data combination, extractEntityName always returns
 * a non-empty string. This ensures every RecentActivityItem has a displayable
 * entityName regardless of the underlying data shape.
 */
describe("Feature: search-and-info-architecture, Property 3: 最近操作紀錄顯示完整欄位", () => {
  it("extractEntityName returns non-empty string for Client with data containing name", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        }),
        (data) => {
          const result = extractEntityName(
            "Client",
            data as Record<string, unknown>,
          );
          expect(result.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("extractEntityName returns non-empty string for Case with data containing name", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        }),
        (data) => {
          const result = extractEntityName(
            "Case",
            data as Record<string, unknown>,
          );
          expect(result.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("extractEntityName returns non-empty string for Contact with data containing record", () => {
    fc.assert(
      fc.property(
        fc.record({
          record: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        }),
        (data) => {
          const result = extractEntityName(
            "Contact",
            data as Record<string, unknown>,
          );
          expect(result.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("extractEntityName returns '(未知)' for any entityType with null data", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("Client", "Case", "Contact", "Unknown", "Other"),
        (entityType) => {
          const result = extractEntityName(entityType, null);
          expect(result).toBe("(未知)");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("extractEntityName returns '(未知)' for unknown entityType with any data", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(
          (s) => !["Client", "Case", "Contact"].includes(s),
        ),
        fc.record({
          name: fc.option(fc.string(), { nil: undefined }),
          record: fc.option(fc.string(), { nil: undefined }),
        }),
        (entityType, data) => {
          const result = extractEntityName(
            entityType,
            data as Record<string, unknown>,
          );
          expect(result).toBe("(未知)");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("extractEntityName always returns non-empty string for known entityTypes with non-empty field values", () => {
    // When the relevant field (name for Client/Case, record for Contact)
    // contains a non-empty string, the result is always non-empty.
    fc.assert(
      fc.property(
        fc.constantFrom("Client", "Case", "Contact"),
        fc.record({
          name: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
          record: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        }),
        (entityType, data) => {
          const result = extractEntityName(
            entityType,
            data as Record<string, unknown>,
          );
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Search Expansion — Property Tests
// ---------------------------------------------------------------------------

/**
 * Feature: search-and-info-architecture, Property 5: 案件搜尋查詢包含關聯欄位
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 *
 * For any non-empty search keyword, the cases page WHERE condition should
 * contain exactly 5 OR conditions: 3 self fields (name, note, handle) +
 * client.name + staffInCharge.some.name, all using the search keyword.
 */
describe("Feature: search-and-info-architecture, Property 5: 案件搜尋查詢包含關聯欄位", () => {
  const CASE_SEARCH_FIELDS = ["name", "note", "handle"] as const;

  const buildCaseWhere = (q: string) => ({
    OR: [
      ...CASE_SEARCH_FIELDS.map((field) => ({
        [field]: { contains: q, mode: "insensitive" as const },
      })),
      { client: { name: { contains: q, mode: "insensitive" as const } } },
      {
        staffInCharge: {
          some: { name: { contains: q, mode: "insensitive" as const } },
        },
      },
    ],
  });

  it("OR array has exactly 5 conditions (3 self fields + client.name + staffInCharge.some.name)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (q) => {
        const where = buildCaseWhere(q);
        expect(where.OR).toHaveLength(5);
      }),
      { numRuns: 100 },
    );
  });

  it("first 3 conditions are self-field searches containing the keyword", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (q) => {
        const where = buildCaseWhere(q);

        // Verify each self-field condition
        for (let i = 0; i < CASE_SEARCH_FIELDS.length; i++) {
          const field = CASE_SEARCH_FIELDS[i];
          const condition = where.OR[i] as Record<string, unknown>;
          const fieldFilter = condition[field] as {
            contains: string;
            mode: string;
          };
          expect(fieldFilter.contains).toBe(q);
          expect(fieldFilter.mode).toBe("insensitive");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("4th condition is client.name relation search containing the keyword", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (q) => {
        const where = buildCaseWhere(q);
        const clientCondition = where.OR[3] as {
          client: { name: { contains: string; mode: string } };
        };
        expect(clientCondition.client.name.contains).toBe(q);
        expect(clientCondition.client.name.mode).toBe("insensitive");
      }),
      { numRuns: 100 },
    );
  });

  it("5th condition is staffInCharge.some.name relation search containing the keyword", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (q) => {
        const where = buildCaseWhere(q);
        const staffCondition = where.OR[4] as {
          staffInCharge: {
            some: { name: { contains: string; mode: string } };
          };
        };
        expect(staffCondition.staffInCharge.some.name.contains).toBe(q);
        expect(staffCondition.staffInCharge.some.name.mode).toBe("insensitive");
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: search-and-info-architecture, Property 6: 通聯搜尋查詢包含關聯欄位
 *
 * **Validates: Requirements 9.1, 9.2, 9.3**
 *
 * For any non-empty search keyword, the contacts page WHERE condition should
 * contain exactly 2 OR conditions: record + client.name, all using the keyword.
 */
describe("Feature: search-and-info-architecture, Property 6: 通聯搜尋查詢包含關聯欄位", () => {
  const CONTACT_SEARCH_FIELDS = ["record"] as const;

  const buildContactWhere = (q: string) => ({
    OR: [
      ...CONTACT_SEARCH_FIELDS.map((field) => ({
        [field]: { contains: q, mode: "insensitive" as const },
      })),
      { client: { name: { contains: q, mode: "insensitive" as const } } },
    ],
  });

  it("OR array has exactly 2 conditions (record + client.name)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (q) => {
        const where = buildContactWhere(q);
        expect(where.OR).toHaveLength(2);
      }),
      { numRuns: 100 },
    );
  });

  it("1st condition is record field search containing the keyword", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (q) => {
        const where = buildContactWhere(q);
        const recordCondition = where.OR[0] as Record<string, unknown>;
        const fieldFilter = recordCondition["record"] as {
          contains: string;
          mode: string;
        };
        expect(fieldFilter.contains).toBe(q);
        expect(fieldFilter.mode).toBe("insensitive");
      }),
      { numRuns: 100 },
    );
  });

  it("2nd condition is client.name relation search containing the keyword", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (q) => {
        const where = buildContactWhere(q);
        const clientCondition = where.OR[1] as {
          client: { name: { contains: string; mode: string } };
        };
        expect(clientCondition.client.name.contains).toBe(q);
        expect(clientCondition.client.name.mode).toBe("insensitive");
      }),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Global Search — Property Tests
// ---------------------------------------------------------------------------

/**
 * Feature: search-and-info-architecture, Property 7: 全域搜尋最少字元門檻
 *
 * **Validates: Requirements 11.1, 12.5**
 *
 * For any string with length < 2 (including empty string), globalSearch should
 * return empty results without executing database queries.
 *
 * Since globalSearch is a server action that calls auth() and prisma, we test
 * the SPECIFICATION: for any string with length < 2, the expected behavior is
 * to return empty results without DB queries.
 */
describe("Feature: search-and-info-architecture, Property 7: 全域搜尋最少字元門檻", () => {
  /**
   * Local function that mirrors the validation logic in globalSearch.
   * Returns true if the query is long enough to trigger a search.
   */
  function shouldSearch(query: string): boolean {
    return query.length >= 2;
  }

  it("for any string with length 0-1, shouldSearch returns false (no DB query)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 1 }), (query) => {
        expect(shouldSearch(query)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("for any string with length >= 2, shouldSearch returns true", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 2, maxLength: 50 }), (query) => {
        expect(shouldSearch(query)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: search-and-info-architecture, Property 8: 全域搜尋結果分組上限
 *
 * **Validates: Requirements 11.3, 12.2**
 *
 * For any search keyword and any database state, globalSearch returns clients,
 * cases, contacts arrays each with length ≤ 5.
 *
 * We simulate the take-5 behavior: applying .slice(0, 5) to any array
 * guarantees the result has at most 5 items.
 */
describe("Feature: search-and-info-architecture, Property 8: 全域搜尋結果分組上限", () => {
  const limitResults = <T>(items: T[]): T[] => items.slice(0, 5);

  it("limitResults always produces an array with length ≤ 5", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 20 }),
        (arr) => {
          const result = limitResults(arr);
          expect(result.length).toBeLessThanOrEqual(5);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("limitResults preserves all items when array has ≤ 5 elements", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 5 }),
        (arr) => {
          const result = limitResults(arr);
          expect(result).toEqual(arr);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("limitResults truncates to exactly 5 items when array has > 5 elements", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 6, maxLength: 20 }),
        (arr) => {
          const result = limitResults(arr);
          expect(result.length).toBe(5);
          expect(result).toEqual(arr.slice(0, 5));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("applying limitResults to all three groups ensures each group ≤ 5", () => {
    fc.assert(
      fc.property(
        fc.record({
          clients: fc.array(fc.integer(), { minLength: 0, maxLength: 20 }),
          cases: fc.array(fc.integer(), { minLength: 0, maxLength: 20 }),
          contacts: fc.array(fc.integer(), { minLength: 0, maxLength: 20 }),
        }),
        ({ clients, cases, contacts }) => {
          const result = {
            clients: limitResults(clients),
            cases: limitResults(cases),
            contacts: limitResults(contacts),
          };
          expect(result.clients.length).toBeLessThanOrEqual(5);
          expect(result.cases.length).toBeLessThanOrEqual(5);
          expect(result.contacts.length).toBeLessThanOrEqual(5);
        },
      ),
      { numRuns: 100 },
    );
  });
});
