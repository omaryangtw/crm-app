import { describe, it, expect } from "vitest";
import fc from "fast-check";

// --- Search field definitions matching the actual page implementations ---

const CLIENT_SEARCH_FIELDS = [
  "name", "mobile", "mobileAlt", "phone", "phoneAlt",
  "dist", "distAlt", "vill", "villAlt", "addr", "addrAlt",
  "addrNote", "addrAltNote", "note",
] as const;

const CASE_SEARCH_FIELDS = ["name", "note", "handle"] as const;

const CONTACT_SEARCH_FIELDS = ["record"] as const;

// --- Pure search-matching functions replicating the Prisma ILIKE logic ---

function clientMatchesSearch(
  client: Record<string, string | null>,
  query: string
): boolean {
  const q = query.toLowerCase();
  return CLIENT_SEARCH_FIELDS.some((field) => {
    const value = client[field];
    return value != null && value.toLowerCase().includes(q);
  });
}

function caseMatchesSearch(
  caseRecord: Record<string, string | null>,
  query: string
): boolean {
  const q = query.toLowerCase();
  return CASE_SEARCH_FIELDS.some((field) => {
    const value = caseRecord[field];
    return value != null && value.toLowerCase().includes(q);
  });
}

function contactMatchesSearch(
  contact: Record<string, string | null>,
  query: string
): boolean {
  const q = query.toLowerCase();
  return CONTACT_SEARCH_FIELDS.some((field) => {
    const value = contact[field];
    return value != null && value.toLowerCase().includes(q);
  });
}


// --- Arbitraries ---

/** Generate a non-empty alphanumeric search string (avoids regex special chars) */
const searchQueryArb = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), { minLength: 1, maxLength: 8 })
  .map((chars) => chars.join(""));

/** Nullable string field */
const nullableStringArb = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 1, maxLength: 30 })
);

/** Build a record with all fields set to nullable random strings */
function buildRecordArb(fields: readonly string[]) {
  const shape: Record<string, fc.Arbitrary<string | null>> = {};
  for (const f of fields) {
    shape[f] = nullableStringArb;
  }
  return fc.record(shape);
}

const clientArb = buildRecordArb(CLIENT_SEARCH_FIELDS);
const caseArb = buildRecordArb(CASE_SEARCH_FIELDS);
const contactArb = buildRecordArb(CONTACT_SEARCH_FIELDS);

/**
 * **Validates: Requirements 5.1, 9.1, 12.1**
 *
 * Property 5: Multi-field search returns matching records
 * If a search string appears (case-insensitive) in ANY searchable field, the record matches.
 * If it does NOT appear in any searchable field, the record does NOT match.
 */
describe("Feature: crm-modernization, Property 5: Multi-field search returns matching records", () => {
  // --- Client search ---

  describe("Client search", () => {
    it("matches when query is injected into any searchable field", () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          clientArb,
          fc.constantFrom(...CLIENT_SEARCH_FIELDS),
          (query, baseClient, targetField) => {
            // Inject the query into one field (mixed case to test case-insensitivity)
            const client = { ...baseClient, [targetField]: "prefix" + query.toUpperCase() + "suffix" };
            expect(clientMatchesSearch(client, query)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("does NOT match when query is absent from all searchable fields", () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          clientArb,
          (query, client) => {
            // Ensure query does not appear in any field
            const sanitized: Record<string, string | null> = {};
            for (const field of CLIENT_SEARCH_FIELDS) {
              const val = client[field];
              if (val != null && val.toLowerCase().includes(query.toLowerCase())) {
                sanitized[field] = val.toLowerCase().replaceAll(query.toLowerCase(), "");
              } else {
                sanitized[field] = val;
              }
            }
            expect(clientMatchesSearch(sanitized, query)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // --- Case search ---

  describe("Case search", () => {
    it("matches when query is injected into any searchable field", () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          caseArb,
          fc.constantFrom(...CASE_SEARCH_FIELDS),
          (query, baseCase, targetField) => {
            const caseRecord = { ...baseCase, [targetField]: query.toUpperCase() };
            expect(caseMatchesSearch(caseRecord, query)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("does NOT match when query is absent from all searchable fields", () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          caseArb,
          (query, caseRecord) => {
            const sanitized: Record<string, string | null> = {};
            for (const field of CASE_SEARCH_FIELDS) {
              const val = caseRecord[field];
              if (val != null && val.toLowerCase().includes(query.toLowerCase())) {
                sanitized[field] = val.toLowerCase().replaceAll(query.toLowerCase(), "");
              } else {
                sanitized[field] = val;
              }
            }
            expect(caseMatchesSearch(sanitized, query)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // --- Contact search ---

  describe("Contact search", () => {
    it("matches when query is injected into the record field", () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          contactArb,
          (query, baseContact) => {
            const contact = { ...baseContact, record: "before" + query.toUpperCase() + "after" };
            expect(contactMatchesSearch(contact, query)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("does NOT match when query is absent from the record field", () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          contactArb,
          (query, contact) => {
            const sanitized: Record<string, string | null> = {};
            for (const field of CONTACT_SEARCH_FIELDS) {
              const val = contact[field];
              if (val != null && val.toLowerCase().includes(query.toLowerCase())) {
                sanitized[field] = val.toLowerCase().replaceAll(query.toLowerCase(), "");
              } else {
                sanitized[field] = val;
              }
            }
            expect(contactMatchesSearch(sanitized, query)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
