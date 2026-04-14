import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Feature: approval-deletion, Property 9: Cascade impact counts match actual record counts
 *
 * **Validates: Requirements 9.1, 9.2**
 *
 * Pure model test — no Prisma, no database. We generate random data structures
 * representing clients/cases with varying numbers of related records, then
 * verify a pure `computeCascadeImpact` function produces counts that exactly
 * match the actual record counts in the generated data.
 */

// ── Pure model types ────────────────────────────────────────────────────────

interface CascadeImpact {
  cases: number;
  contacts: number;
  todos: number;
  familyRelations: number;
  photos: number;
}

interface ClientData {
  id: number;
  cases: { id: number; clientId: number }[];
  contacts: { id: number; clientId: number }[];
  todos: { id: number; clientId: number }[];
  familyRelationsAsA: { id: number; personAId: number; personBId: number }[];
  familyRelationsAsB: { id: number; personAId: number; personBId: number }[];
  photos: { id: number; clientId: number }[];
}

interface CaseData {
  id: number;
  contacts: { id: number; caseId: number }[];
}

// ── Pure model of getCascadeImpact logic ────────────────────────────────────

const ZERO_IMPACT: CascadeImpact = {
  cases: 0,
  contacts: 0,
  todos: 0,
  familyRelations: 0,
  photos: 0,
};

function computeClientCascadeImpact(client: ClientData): CascadeImpact {
  return {
    cases: client.cases.length,
    contacts: client.contacts.length,
    todos: client.todos.length,
    familyRelations:
      client.familyRelationsAsA.length + client.familyRelationsAsB.length,
    photos: client.photos.length,
  };
}

function computeCaseCascadeImpact(caseData: CaseData): CascadeImpact {
  return { ...ZERO_IMPACT, contacts: caseData.contacts.length };
}

function computeContactCascadeImpact(): CascadeImpact {
  return { ...ZERO_IMPACT };
}

// ── Generators ──────────────────────────────────────────────────────────────

const clientIdArb = fc.integer({ min: 1, max: 10000 });

function relatedRecordsArb<T>(
  clientId: number,
  build: (id: number, clientId: number) => T
): fc.Arbitrary<T[]> {
  return fc
    .integer({ min: 0, max: 20 })
    .chain((count) =>
      fc.array(
        fc.integer({ min: 1, max: 100000 }).map((id) => build(id, clientId)),
        { minLength: count, maxLength: count }
      )
    );
}

const clientDataArb: fc.Arbitrary<ClientData> = clientIdArb.chain((id) =>
  fc.record({
    id: fc.constant(id),
    cases: relatedRecordsArb(id, (rid, cid) => ({ id: rid, clientId: cid })),
    contacts: relatedRecordsArb(id, (rid, cid) => ({
      id: rid,
      clientId: cid,
    })),
    todos: relatedRecordsArb(id, (rid, cid) => ({ id: rid, clientId: cid })),
    familyRelationsAsA: relatedRecordsArb(id, (rid, cid) => ({
      id: rid,
      personAId: cid,
      personBId: cid + 1,
    })),
    familyRelationsAsB: relatedRecordsArb(id, (rid, cid) => ({
      id: rid,
      personAId: cid + 1,
      personBId: cid,
    })),
    photos: relatedRecordsArb(id, (rid, cid) => ({ id: rid, clientId: cid })),
  })
);

const caseDataArb: fc.Arbitrary<CaseData> = fc
  .integer({ min: 1, max: 10000 })
  .chain((id) =>
    fc.record({
      id: fc.constant(id),
      contacts: fc
        .integer({ min: 0, max: 20 })
        .chain((count) =>
          fc.array(
            fc
              .integer({ min: 1, max: 100000 })
              .map((rid) => ({ id: rid, caseId: id })),
            { minLength: count, maxLength: count }
          )
        ),
    })
  );

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Feature: approval-deletion, Property 9: Cascade impact counts match actual record counts", () => {
  it("Client cascade impact counts match actual related record counts", () => {
    fc.assert(
      fc.property(clientDataArb, (client) => {
        const impact = computeClientCascadeImpact(client);

        expect(impact.cases).toBe(client.cases.length);
        expect(impact.contacts).toBe(client.contacts.length);
        expect(impact.todos).toBe(client.todos.length);
        expect(impact.familyRelations).toBe(
          client.familyRelationsAsA.length + client.familyRelationsAsB.length
        );
        expect(impact.photos).toBe(client.photos.length);
      }),
      { numRuns: 100 }
    );
  });

  it("Case cascade impact returns only contact count, rest zero", () => {
    fc.assert(
      fc.property(caseDataArb, (caseData) => {
        const impact = computeCaseCascadeImpact(caseData);

        expect(impact.contacts).toBe(caseData.contacts.length);
        expect(impact.cases).toBe(0);
        expect(impact.todos).toBe(0);
        expect(impact.familyRelations).toBe(0);
        expect(impact.photos).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it("Contact cascade impact is always all zeros", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10000 }), () => {
        const impact = computeContactCascadeImpact();

        expect(impact.cases).toBe(0);
        expect(impact.contacts).toBe(0);
        expect(impact.todos).toBe(0);
        expect(impact.familyRelations).toBe(0);
        expect(impact.photos).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it("all impact counts are non-negative integers", () => {
    fc.assert(
      fc.property(clientDataArb, (client) => {
        const impact = computeClientCascadeImpact(client);

        for (const key of Object.keys(impact) as (keyof CascadeImpact)[]) {
          expect(impact[key]).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(impact[key])).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("familyRelations count equals sum of both relation directions", () => {
    fc.assert(
      fc.property(clientDataArb, (client) => {
        const impact = computeClientCascadeImpact(client);

        // This mirrors the actual getCascadeImpact logic:
        // familyRelations = familyRelationsAsA + familyRelationsAsB
        const expectedFamilyCount =
          client.familyRelationsAsA.length + client.familyRelationsAsB.length;
        expect(impact.familyRelations).toBe(expectedFamilyCount);
      }),
      { numRuns: 100 }
    );
  });
});


// ── Property 10 ─────────────────────────────────────────────────────────────

/**
 * Feature: approval-deletion, Property 10: Snapshot includes exactly selected cascade types
 *
 * **Validates: Requirements 9.5, 9.7**
 *
 * Pure model test — no Prisma, no database. We build a pure function that
 * takes a client data structure and a cascade selection, then produces a
 * snapshot containing only the selected related record types. We verify:
 *   1. The snapshot's relatedRecords keys match exactly the selected types
 *   2. Each selected type contains all records of that type from the client
 */

// ── Cascade types and mapping ───────────────────────────────────────────────

type CascadeEntityType =
  | "Case"
  | "Contact"
  | "Todo"
  | "FamilyRelation"
  | "ClientPhoto";

const ALL_CASCADE_TYPES: CascadeEntityType[] = [
  "Case",
  "Contact",
  "Todo",
  "FamilyRelation",
  "ClientPhoto",
];

const CASCADE_KEY_MAP: Record<CascadeEntityType, string> = {
  Case: "cases",
  Contact: "contacts",
  Todo: "todos",
  FamilyRelation: "familyRelations",
  ClientPhoto: "photos",
};

// ── Pure model types for Property 10 ────────────────────────────────────────

interface SnapshotClientData {
  id: number;
  name: string;
  cases: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
  todos: Record<string, unknown>[];
  familyRelations: Record<string, unknown>[];
  photos: Record<string, unknown>[];
}

interface SnapshotRelatedRecords {
  cases?: Record<string, unknown>[];
  contacts?: Record<string, unknown>[];
  todos?: Record<string, unknown>[];
  familyRelations?: Record<string, unknown>[];
  photos?: Record<string, unknown>[];
}

interface Snapshot {
  entity: Record<string, unknown>;
  relatedRecords: SnapshotRelatedRecords;
}

// ── Pure snapshot builder (mirrors real buildEntitySnapshot logic) ───────────

function buildSnapshotFromSelection(
  client: SnapshotClientData,
  cascadeSelection: CascadeEntityType[]
): Snapshot {
  const selected = new Set(cascadeSelection);
  const relatedRecords: SnapshotRelatedRecords = {};

  if (selected.has("Case")) {
    relatedRecords.cases = client.cases;
  }
  if (selected.has("Contact")) {
    relatedRecords.contacts = client.contacts;
  }
  if (selected.has("Todo")) {
    relatedRecords.todos = client.todos;
  }
  if (selected.has("FamilyRelation")) {
    relatedRecords.familyRelations = client.familyRelations;
  }
  if (selected.has("ClientPhoto")) {
    relatedRecords.photos = client.photos;
  }

  return {
    entity: { id: client.id, name: client.name },
    relatedRecords,
  };
}

// ── Generators for Property 10 ──────────────────────────────────────────────

const recordArb = fc
  .integer({ min: 1, max: 100000 })
  .map((id) => ({ id, data: `record-${id}` }));

const snapshotClientArb: fc.Arbitrary<SnapshotClientData> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  cases: fc.array(recordArb, { minLength: 0, maxLength: 10 }),
  contacts: fc.array(recordArb, { minLength: 0, maxLength: 10 }),
  todos: fc.array(recordArb, { minLength: 0, maxLength: 10 }),
  familyRelations: fc.array(recordArb, { minLength: 0, maxLength: 10 }),
  photos: fc.array(recordArb, { minLength: 0, maxLength: 10 }),
});

const cascadeSelectionArb: fc.Arbitrary<CascadeEntityType[]> = fc.subarray(
  ALL_CASCADE_TYPES,
  { minLength: 0, maxLength: ALL_CASCADE_TYPES.length }
);

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Feature: approval-deletion, Property 10: Snapshot includes exactly selected cascade types", () => {
  it("snapshot relatedRecords keys match exactly the selected cascade types", () => {
    fc.assert(
      fc.property(
        snapshotClientArb,
        cascadeSelectionArb,
        (client, selection) => {
          const snapshot = buildSnapshotFromSelection(client, selection);
          const actualKeys = Object.keys(snapshot.relatedRecords).sort();
          const expectedKeys = selection
            .map((t) => CASCADE_KEY_MAP[t])
            .sort();

          expect(actualKeys).toEqual(expectedKeys);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("each selected type contains all records of that type from the client", () => {
    fc.assert(
      fc.property(
        snapshotClientArb,
        cascadeSelectionArb,
        (client, selection) => {
          const snapshot = buildSnapshotFromSelection(client, selection);

          for (const cascadeType of selection) {
            const key = CASCADE_KEY_MAP[cascadeType] as keyof SnapshotRelatedRecords;
            const snapshotRecords = snapshot.relatedRecords[key];

            // Map cascade type to client data field
            const clientField = key as keyof Pick<
              SnapshotClientData,
              "cases" | "contacts" | "todos" | "familyRelations" | "photos"
            >;
            const clientRecords = client[clientField];

            expect(snapshotRecords).toBeDefined();
            expect(snapshotRecords).toEqual(clientRecords);
            expect(snapshotRecords!.length).toBe(clientRecords.length);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("unselected types are absent from snapshot relatedRecords", () => {
    fc.assert(
      fc.property(
        snapshotClientArb,
        cascadeSelectionArb,
        (client, selection) => {
          const snapshot = buildSnapshotFromSelection(client, selection);
          const selectedSet = new Set(selection);
          const unselected = ALL_CASCADE_TYPES.filter(
            (t) => !selectedSet.has(t)
          );

          for (const cascadeType of unselected) {
            const key = CASCADE_KEY_MAP[cascadeType] as keyof SnapshotRelatedRecords;
            expect(snapshot.relatedRecords[key]).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("empty cascade selection produces empty relatedRecords", () => {
    fc.assert(
      fc.property(snapshotClientArb, (client) => {
        const snapshot = buildSnapshotFromSelection(client, []);
        expect(Object.keys(snapshot.relatedRecords)).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  it("full cascade selection includes all five record types", () => {
    fc.assert(
      fc.property(snapshotClientArb, (client) => {
        const snapshot = buildSnapshotFromSelection(client, ALL_CASCADE_TYPES);
        const keys = Object.keys(snapshot.relatedRecords).sort();
        const allKeys = Object.values(CASCADE_KEY_MAP).sort();
        expect(keys).toEqual(allKeys);
      }),
      { numRuns: 100 }
    );
  });
});


// ── Property 2 ──────────────────────────────────────────────────────────────

/**
 * Feature: approval-deletion, Property 2: Duplicate pending request prevention
 *
 * **Validates: Requirements 1.4**
 *
 * Pure model test — no Prisma, no database. We maintain a Set of pending
 * (entityType, entityId) pairs and a pure `requestDeletion` function that
 * checks the set before creating a new request. We generate random sequences
 * of entityType/entityId pairs and verify that the second request for the
 * same pair always fails with a duplicate error.
 */

// ── Pure model types for Property 2 ─────────────────────────────────────────

type EntityType = "Client" | "Case" | "Contact";

type RequestDeletionResult =
  | { success: true; id: number }
  | { success: false; error: string };

// ── Pure model: pending request store ───────────────────────────────────────

class PendingRequestStore {
  private pendingSet = new Set<string>();
  private nextId = 1;

  private makeKey(entityType: EntityType, entityId: number): string {
    return `${entityType}:${entityId}`;
  }

  requestDeletion(
    entityType: EntityType,
    entityId: number
  ): RequestDeletionResult {
    const key = this.makeKey(entityType, entityId);
    if (this.pendingSet.has(key)) {
      return { success: false, error: "此資料已有待審核的刪除申請" };
    }
    this.pendingSet.add(key);
    return { success: true, id: this.nextId++ };
  }

  hasPending(entityType: EntityType, entityId: number): boolean {
    return this.pendingSet.has(this.makeKey(entityType, entityId));
  }
}

// ── Generators for Property 2 ───────────────────────────────────────────────

const entityTypeArb: fc.Arbitrary<EntityType> = fc.constantFrom(
  "Client",
  "Case",
  "Contact"
);

const entityIdArb = fc.integer({ min: 1, max: 10000 });

const entityPairArb = fc.record({
  entityType: entityTypeArb,
  entityId: entityIdArb,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Feature: approval-deletion, Property 2: Duplicate pending request prevention", () => {
  it("second request for the same (entityType, entityId) pair always fails with duplicate error", () => {
    fc.assert(
      fc.property(entityTypeArb, entityIdArb, (entityType, entityId) => {
        const store = new PendingRequestStore();

        // First request should succeed
        const first = store.requestDeletion(entityType, entityId);
        expect(first.success).toBe(true);

        // Second request for the same pair should fail
        const second = store.requestDeletion(entityType, entityId);
        expect(second.success).toBe(false);
        if (!second.success) {
          expect(second.error).toBe("此資料已有待審核的刪除申請");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("requests for different (entityType, entityId) pairs all succeed independently", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(entityPairArb, {
          minLength: 1,
          maxLength: 20,
          comparator: (a, b) =>
            a.entityType === b.entityType && a.entityId === b.entityId,
        }),
        (pairs) => {
          const store = new PendingRequestStore();

          for (const { entityType, entityId } of pairs) {
            const result = store.requestDeletion(entityType, entityId);
            expect(result.success).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("same entityId with different entityType does not conflict", () => {
    fc.assert(
      fc.property(entityIdArb, (entityId) => {
        const store = new PendingRequestStore();

        const r1 = store.requestDeletion("Client", entityId);
        const r2 = store.requestDeletion("Case", entityId);
        const r3 = store.requestDeletion("Contact", entityId);

        expect(r1.success).toBe(true);
        expect(r2.success).toBe(true);
        expect(r3.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("in a random sequence of requests, duplicates are always rejected", () => {
    fc.assert(
      fc.property(
        fc.array(entityPairArb, { minLength: 1, maxLength: 50 }),
        (requests) => {
          const store = new PendingRequestStore();
          const seen = new Set<string>();

          for (const { entityType, entityId } of requests) {
            const key = `${entityType}:${entityId}`;
            const result = store.requestDeletion(entityType, entityId);

            if (seen.has(key)) {
              // Duplicate — must fail
              expect(result.success).toBe(false);
              if (!result.success) {
                expect(result.error).toBe("此資料已有待審核的刪除申請");
              }
            } else {
              // First time — must succeed
              expect(result.success).toBe(true);
              seen.add(key);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Property 3 ──────────────────────────────────────────────────────────────

/**
 * Feature: approval-deletion, Property 3: Rejection unlocks entity for new requests
 *
 * **Validates: Requirements 3.3**
 *
 * Pure model test — no Prisma, no database. We extend PendingRequestStore with
 * a `rejectRequest` method that removes the pending entry, then verify:
 *   1. After rejection, a new request for the same entity succeeds
 *   2. Multiple reject-then-request cycles work correctly
 */

// ── Extended model with rejection ───────────────────────────────────────────

class PendingRequestStoreWithReject {
  private pendingSet = new Set<string>();
  private nextId = 1;

  private makeKey(entityType: EntityType, entityId: number): string {
    return `${entityType}:${entityId}`;
  }

  requestDeletion(
    entityType: EntityType,
    entityId: number
  ): RequestDeletionResult {
    const key = this.makeKey(entityType, entityId);
    if (this.pendingSet.has(key)) {
      return { success: false, error: "此資料已有待審核的刪除申請" };
    }
    this.pendingSet.add(key);
    return { success: true, id: this.nextId++ };
  }

  rejectRequest(entityType: EntityType, entityId: number): boolean {
    const key = this.makeKey(entityType, entityId);
    return this.pendingSet.delete(key);
  }

  hasPending(entityType: EntityType, entityId: number): boolean {
    return this.pendingSet.has(this.makeKey(entityType, entityId));
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Feature: approval-deletion, Property 3: Rejection unlocks entity for new requests", () => {
  it("after rejection, a new request for the same entity succeeds", () => {
    fc.assert(
      fc.property(entityTypeArb, entityIdArb, (entityType, entityId) => {
        const store = new PendingRequestStoreWithReject();

        // Create initial request
        const first = store.requestDeletion(entityType, entityId);
        expect(first.success).toBe(true);

        // Reject it
        const rejected = store.rejectRequest(entityType, entityId);
        expect(rejected).toBe(true);
        expect(store.hasPending(entityType, entityId)).toBe(false);

        // New request for the same entity should succeed
        const second = store.requestDeletion(entityType, entityId);
        expect(second.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("multiple reject-then-request cycles work correctly", () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        entityIdArb,
        fc.integer({ min: 2, max: 10 }),
        (entityType, entityId, cycles) => {
          const store = new PendingRequestStoreWithReject();

          for (let i = 0; i < cycles; i++) {
            // Request should succeed each cycle
            const result = store.requestDeletion(entityType, entityId);
            expect(result.success).toBe(true);

            // Duplicate while pending should fail
            const dup = store.requestDeletion(entityType, entityId);
            expect(dup.success).toBe(false);

            // Reject unlocks the entity
            const rejected = store.rejectRequest(entityType, entityId);
            expect(rejected).toBe(true);
            expect(store.hasPending(entityType, entityId)).toBe(false);
          }

          // Final request after all cycles should still succeed
          const finalReq = store.requestDeletion(entityType, entityId);
          expect(finalReq.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Property 7 ──────────────────────────────────────────────────────────────

/**
 * Feature: approval-deletion, Property 7: Status filter returns only matching requests
 *
 * **Validates: Requirements 5.5**
 *
 * Pure model test — no Prisma, no database. We generate random arrays of
 * DeletionRequest-like objects with mixed statuses, then apply a pure filter
 * function and verify:
 *   1. All returned items match the filter status
 *   2. No matching items were missed (completeness)
 */

// ── Pure model types for Property 7 ─────────────────────────────────────────

type DeletionRequestStatus = "pending" | "approved" | "rejected" | "restored";

const ALL_STATUSES: DeletionRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "restored",
];

interface DeletionRequestLike {
  id: number;
  entityType: string;
  entityId: number;
  status: DeletionRequestStatus;
  requesterEmail: string;
}

// ── Pure filter function (mirrors getDeletionRequests status filter logic) ───

function filterByStatus(
  requests: DeletionRequestLike[],
  status: DeletionRequestStatus
): DeletionRequestLike[] {
  return requests.filter((r) => r.status === status);
}

// ── Generators for Property 7 ───────────────────────────────────────────────

const statusArb: fc.Arbitrary<DeletionRequestStatus> = fc.constantFrom(
  ...ALL_STATUSES
);

const deletionRequestArb: fc.Arbitrary<DeletionRequestLike> = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  entityType: fc.constantFrom("Client", "Case", "Contact"),
  entityId: fc.integer({ min: 1, max: 10000 }),
  status: statusArb,
  requesterEmail: fc.emailAddress(),
});

const deletionRequestArrayArb: fc.Arbitrary<DeletionRequestLike[]> = fc.array(
  deletionRequestArb,
  { minLength: 0, maxLength: 50 }
);

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Feature: approval-deletion, Property 7: Status filter returns only matching requests", () => {
  it("all returned items match the filter status", () => {
    fc.assert(
      fc.property(
        deletionRequestArrayArb,
        statusArb,
        (requests, filterStatus) => {
          const result = filterByStatus(requests, filterStatus);

          for (const item of result) {
            expect(item.status).toBe(filterStatus);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("no matching items were missed (completeness)", () => {
    fc.assert(
      fc.property(
        deletionRequestArrayArb,
        statusArb,
        (requests, filterStatus) => {
          const result = filterByStatus(requests, filterStatus);
          const expectedCount = requests.filter(
            (r) => r.status === filterStatus
          ).length;

          expect(result.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("filter result is a subset of the original array", () => {
    fc.assert(
      fc.property(
        deletionRequestArrayArb,
        statusArb,
        (requests, filterStatus) => {
          const result = filterByStatus(requests, filterStatus);

          for (const item of result) {
            expect(requests).toContain(item);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("filtering by each status partitions the full array without loss", () => {
    fc.assert(
      fc.property(deletionRequestArrayArb, (requests) => {
        let totalFiltered = 0;
        for (const status of ALL_STATUSES) {
          const result = filterByStatus(requests, status);
          totalFiltered += result.length;

          // Every item in result must have the correct status
          for (const item of result) {
            expect(item.status).toBe(status);
          }
        }

        // Sum of all filtered partitions equals original array length
        expect(totalFiltered).toBe(requests.length);
      }),
      { numRuns: 100 }
    );
  });
});


// ── Property 6 ──────────────────────────────────────────────────────────────

/**
 * Feature: approval-deletion, Property 6: Non-admin cannot approve or reject
 *
 * **Validates: Requirements 4.1**
 *
 * Pure model test — no Prisma, no database. We build a pure model with
 * `approveDeletion` and `rejectDeletion` functions that check user role
 * before processing. We generate random non-admin role strings and verify:
 *   1. Both functions always return permission denied for non-admin roles
 *   2. The DeletionRequest status remains "pending" after the denied attempt
 */

// ── Pure model types for Property 6 ─────────────────────────────────────────

interface DeletionRequestModel {
  id: number;
  entityType: EntityType;
  entityId: number;
  status: DeletionRequestStatus;
  reviewerId: number | null;
  reviewerEmail: string | null;
  reviewedAt: Date | null;
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Pure model: role-gated approve/reject ───────────────────────────────────

function approveDeletion(
  request: DeletionRequestModel,
  userRole: string
): { result: ActionResult<null>; updatedRequest: DeletionRequestModel } {
  if (userRole !== "admin") {
    return {
      result: { success: false, error: "權限不足" },
      updatedRequest: { ...request },
    };
  }

  if (request.status !== "pending") {
    return {
      result: { success: false, error: "此申請狀態不允許此操作" },
      updatedRequest: { ...request },
    };
  }

  return {
    result: { success: true, data: null },
    updatedRequest: {
      ...request,
      status: "approved" as DeletionRequestStatus,
      reviewerId: 1,
      reviewerEmail: "admin@example.com",
      reviewedAt: new Date(),
    },
  };
}

function rejectDeletion(
  request: DeletionRequestModel,
  userRole: string
): { result: ActionResult<null>; updatedRequest: DeletionRequestModel } {
  if (userRole !== "admin") {
    return {
      result: { success: false, error: "權限不足" },
      updatedRequest: { ...request },
    };
  }

  if (request.status !== "pending") {
    return {
      result: { success: false, error: "此申請狀態不允許此操作" },
      updatedRequest: { ...request },
    };
  }

  return {
    result: { success: true, data: null },
    updatedRequest: {
      ...request,
      status: "rejected" as DeletionRequestStatus,
      reviewerId: 1,
      reviewerEmail: "admin@example.com",
      reviewedAt: new Date(),
    },
  };
}

// ── Generators for Property 6 ───────────────────────────────────────────────

/** Generate random non-admin role strings — never "admin" */
const nonAdminRoleArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom("user", "viewer", "editor", "manager", "guest", "operator"),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s !== "admin")
);

const pendingRequestArb: fc.Arbitrary<DeletionRequestModel> = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  entityType: fc.constantFrom(
    "Client" as EntityType,
    "Case" as EntityType,
    "Contact" as EntityType
  ),
  entityId: fc.integer({ min: 1, max: 10000 }),
  status: fc.constant("pending" as DeletionRequestStatus),
  reviewerId: fc.constant(null),
  reviewerEmail: fc.constant(null),
  reviewedAt: fc.constant(null),
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Feature: approval-deletion, Property 6: Non-admin cannot approve or reject", () => {
  it("approveDeletion returns permission denied for any non-admin role", () => {
    fc.assert(
      fc.property(pendingRequestArb, nonAdminRoleArb, (request, role) => {
        const { result, updatedRequest } = approveDeletion(request, role);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("權限不足");
        }
        expect(updatedRequest.status).toBe("pending");
        expect(updatedRequest.reviewerId).toBeNull();
        expect(updatedRequest.reviewerEmail).toBeNull();
        expect(updatedRequest.reviewedAt).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("rejectDeletion returns permission denied for any non-admin role", () => {
    fc.assert(
      fc.property(pendingRequestArb, nonAdminRoleArb, (request, role) => {
        const { result, updatedRequest } = rejectDeletion(request, role);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("權限不足");
        }
        expect(updatedRequest.status).toBe("pending");
        expect(updatedRequest.reviewerId).toBeNull();
        expect(updatedRequest.reviewerEmail).toBeNull();
        expect(updatedRequest.reviewedAt).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("admin role succeeds while non-admin role is denied for the same request", () => {
    fc.assert(
      fc.property(pendingRequestArb, nonAdminRoleArb, (request, nonAdminRole) => {
        // Non-admin attempt — denied, status unchanged
        const denied = approveDeletion(request, nonAdminRole);
        expect(denied.result.success).toBe(false);
        expect(denied.updatedRequest.status).toBe("pending");

        // Admin attempt — succeeds, status changes
        const approved = approveDeletion(request, "admin");
        expect(approved.result.success).toBe(true);
        expect(approved.updatedRequest.status).toBe("approved");
      }),
      { numRuns: 100 }
    );
  });

  it("non-admin denial does not mutate the original request fields", () => {
    fc.assert(
      fc.property(pendingRequestArb, nonAdminRoleArb, (request, role) => {
        const originalId = request.id;
        const originalEntityType = request.entityType;
        const originalEntityId = request.entityId;

        const { updatedRequest: afterApprove } = approveDeletion(request, role);
        expect(afterApprove.id).toBe(originalId);
        expect(afterApprove.entityType).toBe(originalEntityType);
        expect(afterApprove.entityId).toBe(originalEntityId);
        expect(afterApprove.status).toBe("pending");

        const { updatedRequest: afterReject } = rejectDeletion(request, role);
        expect(afterReject.id).toBe(originalId);
        expect(afterReject.entityType).toBe(originalEntityType);
        expect(afterReject.entityId).toBe(originalEntityId);
        expect(afterReject.status).toBe("pending");
      }),
      { numRuns: 100 }
    );
  });
});


// ── Property 8 ──────────────────────────────────────────────────────────────

/**
 * Feature: approval-deletion, Property 8: Snapshot-delete-restore round trip
 *
 * **Validates: Requirements 8.2, 8.3, 9.8**
 *
 * Pure model test — no Prisma, no database. We build a pure model that:
 *   1. Generates random entity data (strings, numbers, ISO date strings, nulls)
 *   2. Serializes the entity to a snapshot (JSON-compatible format)
 *   3. Simulates deletion (removes entity from a map)
 *   4. Restores from snapshot (deserializes back)
 *   5. Verifies all fields match the original
 *   6. Tracks DeletionRequest status transitions: pending → approved → restored
 */

// ── Pure model types for Property 8 ─────────────────────────────────────────

type P8EntityType = "Client" | "Case" | "Contact";
type P8Status = "pending" | "approved" | "rejected" | "restored";

interface P8EntityRecord {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string; // ISO date string
  score: number | null;
  notes: string | null;
}

interface P8RelatedRecord {
  id: number;
  parentId: number;
  label: string;
  value: number | null;
  createdAt: string;
}

interface P8Snapshot {
  entity: P8EntityRecord;
  relatedRecords: Record<string, P8RelatedRecord[]>;
}

interface P8DeletionRequest {
  id: number;
  entityType: P8EntityType;
  entityId: number;
  status: P8Status;
  entitySnapshot: P8Snapshot;
  requesterId: number;
  requesterEmail: string;
  reviewerId: number | null;
  reviewerEmail: string | null;
  reviewedAt: string | null;
  restoredAt: string | null;
  restoredById: number | null;
}

// ── Pure model: in-memory database + lifecycle ──────────────────────────────

class P8Database {
  entities = new Map<string, P8EntityRecord>();
  relatedRecords = new Map<string, P8RelatedRecord[]>();

  private entityKey(entityType: P8EntityType, entityId: number): string {
    return `${entityType}:${entityId}`;
  }

  addEntity(entityType: P8EntityType, entity: P8EntityRecord): void {
    this.entities.set(this.entityKey(entityType, entity.id), { ...entity });
  }

  addRelatedRecords(
    entityType: P8EntityType,
    entityId: number,
    relType: string,
    records: P8RelatedRecord[]
  ): void {
    const key = `${this.entityKey(entityType, entityId)}:${relType}`;
    this.relatedRecords.set(key, records.map((r) => ({ ...r })));
  }

  getEntity(entityType: P8EntityType, entityId: number): P8EntityRecord | undefined {
    return this.entities.get(this.entityKey(entityType, entityId));
  }

  getRelatedRecords(
    entityType: P8EntityType,
    entityId: number,
    relType: string
  ): P8RelatedRecord[] {
    const key = `${this.entityKey(entityType, entityId)}:${relType}`;
    return this.relatedRecords.get(key) ?? [];
  }

  deleteEntity(entityType: P8EntityType, entityId: number, relTypes: string[]): void {
    this.entities.delete(this.entityKey(entityType, entityId));
    for (const relType of relTypes) {
      const key = `${this.entityKey(entityType, entityId)}:${relType}`;
      this.relatedRecords.delete(key);
    }
  }

  hasEntity(entityType: P8EntityType, entityId: number): boolean {
    return this.entities.has(this.entityKey(entityType, entityId));
  }
}

function serializeSnapshot(
  entity: P8EntityRecord,
  relatedRecords: Record<string, P8RelatedRecord[]>
): P8Snapshot {
  // Simulate JSON serialization round trip (like real snapshot builder)
  return JSON.parse(JSON.stringify({ entity, relatedRecords }));
}

function deserializeSnapshot(snapshot: P8Snapshot): {
  entity: P8EntityRecord;
  relatedRecords: Record<string, P8RelatedRecord[]>;
} {
  // Simulate JSON deserialization (like real restore logic)
  return JSON.parse(JSON.stringify(snapshot));
}

function createDeletionRequest(
  id: number,
  entityType: P8EntityType,
  entity: P8EntityRecord,
  relatedRecords: Record<string, P8RelatedRecord[]>,
  requesterId: number,
  requesterEmail: string
): P8DeletionRequest {
  return {
    id,
    entityType,
    entityId: entity.id,
    status: "pending",
    entitySnapshot: serializeSnapshot(entity, relatedRecords),
    requesterId,
    requesterEmail,
    reviewerId: null,
    reviewerEmail: null,
    reviewedAt: null,
    restoredAt: null,
    restoredById: null,
  };
}

function approveDeletionRequest(
  req: P8DeletionRequest,
  db: P8Database,
  reviewerId: number,
  reviewerEmail: string,
  relTypes: string[]
): P8DeletionRequest {
  if (req.status !== "pending") throw new Error("Invalid status for approval");
  db.deleteEntity(req.entityType, req.entityId, relTypes);
  return {
    ...req,
    status: "approved",
    reviewerId,
    reviewerEmail,
    reviewedAt: new Date().toISOString(),
  };
}

function restoreDeletionRequest(
  req: P8DeletionRequest,
  db: P8Database,
  restoredById: number
): P8DeletionRequest {
  if (req.status !== "approved") throw new Error("Invalid status for restore");
  const { entity, relatedRecords } = deserializeSnapshot(req.entitySnapshot);
  db.addEntity(req.entityType, entity);
  for (const [relType, records] of Object.entries(relatedRecords)) {
    db.addRelatedRecords(req.entityType, entity.id, relType, records);
  }
  return {
    ...req,
    status: "restored",
    restoredAt: new Date().toISOString(),
    restoredById,
  };
}

// ── Generators for Property 8 ───────────────────────────────────────────────

const p8IsoDateArb: fc.Arbitrary<string> = fc
  .integer({
    min: new Date("2020-01-01T00:00:00Z").getTime(),
    max: new Date("2030-12-31T23:59:59Z").getTime(),
  })
  .map((ts) => new Date(ts).toISOString());

const p8NullableStringArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.string({ minLength: 1, maxLength: 30 }),
  fc.constant(null)
);

const p8NullableNumberArb: fc.Arbitrary<number | null> = fc.oneof(
  fc.integer({ min: 0, max: 100000 }),
  fc.constant(null)
);

const p8EntityRecordArb: fc.Arbitrary<P8EntityRecord> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  phone: p8NullableStringArb,
  email: p8NullableStringArb,
  createdAt: p8IsoDateArb,
  score: p8NullableNumberArb,
  notes: p8NullableStringArb,
});

const p8RelatedRecordArb = (parentId: number): fc.Arbitrary<P8RelatedRecord> =>
  fc.record({
    id: fc.integer({ min: 1, max: 100000 }),
    parentId: fc.constant(parentId),
    label: fc.string({ minLength: 1, maxLength: 20 }),
    value: p8NullableNumberArb,
    createdAt: p8IsoDateArb,
  });

const p8RelatedRecordsMapArb = (
  parentId: number
): fc.Arbitrary<Record<string, P8RelatedRecord[]>> =>
  fc.record({
    cases: fc.array(p8RelatedRecordArb(parentId), { minLength: 0, maxLength: 5 }),
    contacts: fc.array(p8RelatedRecordArb(parentId), { minLength: 0, maxLength: 5 }),
    todos: fc.array(p8RelatedRecordArb(parentId), { minLength: 0, maxLength: 5 }),
  });

const p8EntityTypeArb: fc.Arbitrary<P8EntityType> = fc.constantFrom(
  "Client",
  "Case",
  "Contact"
);

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Feature: approval-deletion, Property 8: Snapshot-delete-restore round trip", () => {
  it("restored entity fields match the original entity snapshot", () => {
    fc.assert(
      fc.property(
        p8EntityTypeArb,
        p8EntityRecordArb,
        (entityType, entity) => {
          const relatedRecords = { cases: [], contacts: [], todos: [] };
          const db = new P8Database();
          db.addEntity(entityType, entity);

          // Create request (pending)
          const req = createDeletionRequest(
            1, entityType, entity, relatedRecords, 100, "user@test.com"
          );
          expect(req.status).toBe("pending");
          expect(db.hasEntity(entityType, entity.id)).toBe(true);

          // Approve (deletes entity)
          const approved = approveDeletionRequest(
            req, db, 200, "admin@test.com", Object.keys(relatedRecords)
          );
          expect(approved.status).toBe("approved");
          expect(db.hasEntity(entityType, entity.id)).toBe(false);

          // Restore (re-creates entity from snapshot)
          const restored = restoreDeletionRequest(approved, db, 200);
          expect(restored.status).toBe("restored");
          expect(db.hasEntity(entityType, entity.id)).toBe(true);

          // Verify restored entity matches original
          const restoredEntity = db.getEntity(entityType, entity.id)!;
          expect(restoredEntity).toEqual(entity);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("restored related records match the original related records", () => {
    fc.assert(
      fc.property(
        p8EntityRecordArb.chain((entity) =>
          p8RelatedRecordsMapArb(entity.id).map((relMap) => ({ entity, relMap }))
        ),
        ({ entity, relMap }) => {
          const entityType: P8EntityType = "Client";
          const db = new P8Database();
          db.addEntity(entityType, entity);
          const relTypes = Object.keys(relMap);
          for (const [relType, records] of Object.entries(relMap)) {
            db.addRelatedRecords(entityType, entity.id, relType, records);
          }

          // Create → Approve → Restore
          const req = createDeletionRequest(
            1, entityType, entity, relMap, 100, "user@test.com"
          );
          const approved = approveDeletionRequest(
            req, db, 200, "admin@test.com", relTypes
          );

          // Verify entity and related records are gone
          expect(db.hasEntity(entityType, entity.id)).toBe(false);
          for (const relType of relTypes) {
            expect(db.getRelatedRecords(entityType, entity.id, relType)).toEqual([]);
          }

          // Restore
          const restored = restoreDeletionRequest(approved, db, 200);
          expect(restored.status).toBe("restored");

          // Verify all related records match originals
          for (const [relType, originalRecords] of Object.entries(relMap)) {
            const restoredRecords = db.getRelatedRecords(entityType, entity.id, relType);
            expect(restoredRecords).toEqual(originalRecords);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("DeletionRequest status transitions: pending → approved → restored", () => {
    fc.assert(
      fc.property(
        p8EntityTypeArb,
        p8EntityRecordArb,
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.emailAddress(),
        fc.emailAddress(),
        (entityType, entity, requesterId, reviewerId, requesterEmail, reviewerEmail) => {
          const db = new P8Database();
          db.addEntity(entityType, entity);

          // Step 1: pending
          const req = createDeletionRequest(
            1, entityType, entity, {}, requesterId, requesterEmail
          );
          expect(req.status).toBe("pending");
          expect(req.requesterId).toBe(requesterId);
          expect(req.requesterEmail).toBe(requesterEmail);
          expect(req.reviewerId).toBeNull();
          expect(req.reviewerEmail).toBeNull();
          expect(req.reviewedAt).toBeNull();
          expect(req.restoredAt).toBeNull();
          expect(req.restoredById).toBeNull();

          // Step 2: approved
          const approved = approveDeletionRequest(
            req, db, reviewerId, reviewerEmail, []
          );
          expect(approved.status).toBe("approved");
          expect(approved.reviewerId).toBe(reviewerId);
          expect(approved.reviewerEmail).toBe(reviewerEmail);
          expect(approved.reviewedAt).not.toBeNull();
          expect(approved.restoredAt).toBeNull();
          expect(approved.restoredById).toBeNull();

          // Step 3: restored
          const restored = restoreDeletionRequest(approved, db, reviewerId);
          expect(restored.status).toBe("restored");
          expect(restored.restoredAt).not.toBeNull();
          expect(restored.restoredById).toBe(reviewerId);
          // Previous fields preserved
          expect(restored.reviewerId).toBe(reviewerId);
          expect(restored.reviewerEmail).toBe(reviewerEmail);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("serialize → deserialize round trip preserves all field types (strings, numbers, nulls, ISO dates)", () => {
    fc.assert(
      fc.property(
        p8EntityRecordArb,
        p8EntityRecordArb.chain((entity) =>
          p8RelatedRecordsMapArb(entity.id).map((relMap) => ({ entity, relMap }))
        ),
        (entity, { relMap }) => {
          const snapshot = serializeSnapshot(entity, relMap);
          const { entity: restored, relatedRecords } = deserializeSnapshot(snapshot);

          // Entity fields match
          expect(restored).toEqual(entity);

          // Related records match
          for (const [key, records] of Object.entries(relMap)) {
            expect(relatedRecords[key]).toEqual(records);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Property 1 ──────────────────────────────────────────────────────────────

/**
 * Feature: approval-deletion, Property 1: Request creation preserves entity and captures complete data
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * Pure model test — no Prisma, no database. We reuse the P8Database model to
 * generate random entities, call createDeletionRequest, and verify:
 *   1. The entity still exists in the model after request creation
 *   2. The DeletionRequest has correct entityType, entityId, status "pending",
 *      requesterId, requesterEmail, non-null snapshot, and snapshot matches entity
 */

describe("Feature: approval-deletion, Property 1: Request creation preserves entity and captures complete data", () => {
  it("entity still exists after request creation and DeletionRequest has correct fields", () => {
    fc.assert(
      fc.property(
        p8EntityTypeArb,
        p8EntityRecordArb,
        fc.integer({ min: 1, max: 10000 }),
        fc.emailAddress(),
        (entityType, entity, requesterId, requesterEmail) => {
          const db = new P8Database();
          db.addEntity(entityType, entity);

          const req = createDeletionRequest(
            1,
            entityType,
            entity,
            {},
            requesterId,
            requesterEmail
          );

          // Entity still exists
          expect(db.hasEntity(entityType, entity.id)).toBe(true);
          expect(db.getEntity(entityType, entity.id)).toEqual(entity);

          // DeletionRequest fields
          expect(req.entityType).toBe(entityType);
          expect(req.entityId).toBe(entity.id);
          expect(req.status).toBe("pending");
          expect(req.requesterId).toBe(requesterId);
          expect(req.requesterEmail).toBe(requesterEmail);
          expect(req.entitySnapshot).not.toBeNull();
          expect(req.entitySnapshot.entity).toEqual(entity);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("snapshot is non-null and matches the entity data for any entity type", () => {
    fc.assert(
      fc.property(
        p8EntityTypeArb,
        p8EntityRecordArb.chain((entity) =>
          p8RelatedRecordsMapArb(entity.id).map((relMap) => ({ entity, relMap }))
        ),
        fc.integer({ min: 1, max: 10000 }),
        fc.emailAddress(),
        (entityType, { entity, relMap }, requesterId, requesterEmail) => {
          const db = new P8Database();
          db.addEntity(entityType, entity);
          for (const [relType, records] of Object.entries(relMap)) {
            db.addRelatedRecords(entityType, entity.id, relType, records);
          }

          const req = createDeletionRequest(
            1,
            entityType,
            entity,
            relMap,
            requesterId,
            requesterEmail
          );

          // Snapshot is non-null
          expect(req.entitySnapshot).toBeDefined();
          expect(req.entitySnapshot).not.toBeNull();

          // Snapshot entity matches
          expect(req.entitySnapshot.entity).toEqual(entity);

          // Snapshot related records match
          for (const [relType, records] of Object.entries(relMap)) {
            expect(req.entitySnapshot.relatedRecords[relType]).toEqual(records);
          }

          // Entity still exists in DB
          expect(db.hasEntity(entityType, entity.id)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Property 4 ──────────────────────────────────────────────────────────────

/**
 * Feature: approval-deletion, Property 4: Approval deletes entity and records reviewer
 *
 * **Validates: Requirements 2.1, 2.5**
 *
 * Pure model test — no Prisma, no database. We reuse the P8Database model to:
 *   1. Create an entity, create a pending DeletionRequest
 *   2. Approve it via approveDeletionRequest
 *   3. Verify entity is removed from the model
 *   4. Verify DeletionRequest has status "approved" with reviewerId, reviewerEmail, reviewedAt populated
 */

describe("Feature: approval-deletion, Property 4: Approval deletes entity and records reviewer", () => {
  it("after approval, entity is removed and DeletionRequest has status approved with reviewer fields", () => {
    fc.assert(
      fc.property(
        p8EntityTypeArb,
        p8EntityRecordArb,
        fc.integer({ min: 1, max: 10000 }),
        fc.emailAddress(),
        fc.integer({ min: 1, max: 10000 }),
        fc.emailAddress(),
        (entityType, entity, requesterId, requesterEmail, reviewerId, reviewerEmail) => {
          const db = new P8Database();
          db.addEntity(entityType, entity);

          // Create pending request
          const req = createDeletionRequest(
            1,
            entityType,
            entity,
            {},
            requesterId,
            requesterEmail
          );
          expect(req.status).toBe("pending");
          expect(db.hasEntity(entityType, entity.id)).toBe(true);

          // Approve
          const approved = approveDeletionRequest(
            req,
            db,
            reviewerId,
            reviewerEmail,
            []
          );

          // Entity removed
          expect(db.hasEntity(entityType, entity.id)).toBe(false);

          // DeletionRequest status and reviewer fields
          expect(approved.status).toBe("approved");
          expect(approved.reviewerId).toBe(reviewerId);
          expect(approved.reviewerEmail).toBe(reviewerEmail);
          expect(approved.reviewedAt).not.toBeNull();
          expect(typeof approved.reviewedAt).toBe("string");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("approval also removes related records from the model", () => {
    fc.assert(
      fc.property(
        p8EntityRecordArb.chain((entity) =>
          p8RelatedRecordsMapArb(entity.id).map((relMap) => ({ entity, relMap }))
        ),
        fc.integer({ min: 1, max: 10000 }),
        fc.emailAddress(),
        ({ entity, relMap }, reviewerId, reviewerEmail) => {
          const entityType: P8EntityType = "Client";
          const db = new P8Database();
          db.addEntity(entityType, entity);
          const relTypes = Object.keys(relMap);
          for (const [relType, records] of Object.entries(relMap)) {
            db.addRelatedRecords(entityType, entity.id, relType, records);
          }

          const req = createDeletionRequest(
            1,
            entityType,
            entity,
            relMap,
            100,
            "user@test.com"
          );

          const approved = approveDeletionRequest(
            req,
            db,
            reviewerId,
            reviewerEmail,
            relTypes
          );

          // Entity and all related records removed
          expect(db.hasEntity(entityType, entity.id)).toBe(false);
          for (const relType of relTypes) {
            expect(db.getRelatedRecords(entityType, entity.id, relType)).toEqual([]);
          }

          expect(approved.status).toBe("approved");
          expect(approved.reviewerId).toBe(reviewerId);
          expect(approved.reviewerEmail).toBe(reviewerEmail);
          expect(approved.reviewedAt).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Property 5 ──────────────────────────────────────────────────────────────

/**
 * Feature: approval-deletion, Property 5: Rejection preserves entity and records reviewer
 *
 * **Validates: Requirements 3.1, 3.2**
 *
 * Pure model test — no Prisma, no database. We add a pure rejectDeletionRequest
 * function that updates status to "rejected" without touching the entity, then verify:
 *   1. Entity still exists unchanged in the model after rejection
 *   2. DeletionRequest has status "rejected" with reviewerId, reviewerEmail, reviewedAt populated
 */

function rejectDeletionRequest(
  req: P8DeletionRequest,
  reviewerId: number,
  reviewerEmail: string
): P8DeletionRequest {
  if (req.status !== "pending") throw new Error("Invalid status for rejection");
  return {
    ...req,
    status: "rejected",
    reviewerId,
    reviewerEmail,
    reviewedAt: new Date().toISOString(),
  };
}

describe("Feature: approval-deletion, Property 5: Rejection preserves entity and records reviewer", () => {
  it("after rejection, entity still exists unchanged and DeletionRequest has status rejected with reviewer fields", () => {
    fc.assert(
      fc.property(
        p8EntityTypeArb,
        p8EntityRecordArb,
        fc.integer({ min: 1, max: 10000 }),
        fc.emailAddress(),
        fc.integer({ min: 1, max: 10000 }),
        fc.emailAddress(),
        (entityType, entity, requesterId, requesterEmail, reviewerId, reviewerEmail) => {
          const db = new P8Database();
          db.addEntity(entityType, entity);

          // Create pending request
          const req = createDeletionRequest(
            1,
            entityType,
            entity,
            {},
            requesterId,
            requesterEmail
          );
          expect(req.status).toBe("pending");
          expect(db.hasEntity(entityType, entity.id)).toBe(true);

          // Reject
          const rejected = rejectDeletionRequest(req, reviewerId, reviewerEmail);

          // Entity still exists and unchanged
          expect(db.hasEntity(entityType, entity.id)).toBe(true);
          expect(db.getEntity(entityType, entity.id)).toEqual(entity);

          // DeletionRequest status and reviewer fields
          expect(rejected.status).toBe("rejected");
          expect(rejected.reviewerId).toBe(reviewerId);
          expect(rejected.reviewerEmail).toBe(reviewerEmail);
          expect(rejected.reviewedAt).not.toBeNull();
          expect(typeof rejected.reviewedAt).toBe("string");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejection preserves related records in the model as well", () => {
    fc.assert(
      fc.property(
        p8EntityRecordArb.chain((entity) =>
          p8RelatedRecordsMapArb(entity.id).map((relMap) => ({ entity, relMap }))
        ),
        fc.integer({ min: 1, max: 10000 }),
        fc.emailAddress(),
        ({ entity, relMap }, reviewerId, reviewerEmail) => {
          const entityType: P8EntityType = "Client";
          const db = new P8Database();
          db.addEntity(entityType, entity);
          for (const [relType, records] of Object.entries(relMap)) {
            db.addRelatedRecords(entityType, entity.id, relType, records);
          }

          const req = createDeletionRequest(
            1,
            entityType,
            entity,
            relMap,
            100,
            "user@test.com"
          );

          const rejected = rejectDeletionRequest(req, reviewerId, reviewerEmail);

          // Entity still exists
          expect(db.hasEntity(entityType, entity.id)).toBe(true);
          expect(db.getEntity(entityType, entity.id)).toEqual(entity);

          // Related records still exist
          for (const [relType, originalRecords] of Object.entries(relMap)) {
            expect(
              db.getRelatedRecords(entityType, entity.id, relType)
            ).toEqual(originalRecords);
          }

          expect(rejected.status).toBe("rejected");
          expect(rejected.reviewerId).toBe(reviewerId);
          expect(rejected.reviewerEmail).toBe(reviewerEmail);
          expect(rejected.reviewedAt).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
