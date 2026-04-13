import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  getInverseRelationship,
  VALID_RELATIONSHIPS,
  RELATIONSHIP_INVERSE_MAP,
} from "@/app/_lib/constants/relationship-map";

/**
 * **Validates: Requirements 17.5**
 *
 * Property 12: Bidirectional relationship creation
 * Tests the pure logic that drives createFamilyRelation:
 * - When inverse is non-empty, both forward (relationAToB) and reverse (relationBToA) should be set
 * - When inverse is empty, only forward should be set (reverse is empty string)
 */
describe("Feature: crm-modernization, Property 12: Bidirectional relationship creation", () => {
  const sexArb = fc.constantFrom("male" as const, "female" as const);

  it("when inverse is non-empty, both forward and reverse relationship strings are set", () => {
    // Filter to only relationships that produce a non-empty inverse
    const nonEmptyInverseArb = fc
      .record({
        relation: fc.constantFrom(...VALID_RELATIONSHIPS),
        sex: sexArb,
      })
      .filter(({ relation, sex }) => {
        const inv = RELATIONSHIP_INVERSE_MAP[relation]?.[sex];
        return inv !== undefined && inv !== "";
      });

    fc.assert(
      fc.property(nonEmptyInverseArb, ({ relation, sex }) => {
        const inverse = getInverseRelationship(relation, sex);

        // Simulate what createFamilyRelation stores in a single row
        const relationAToB = relation;
        const relationBToA = inverse;

        // Forward must be the original relationship
        expect(relationAToB).toBe(relation);
        // Reverse must be non-empty and match the inverse map
        expect(relationBToA).not.toBe("");
        expect(relationBToA).toBe(RELATIONSHIP_INVERSE_MAP[relation][sex]);
      }),
      { numRuns: 100 }
    );
  });

  it("when inverse is empty, only forward is set and reverse is empty string", () => {
    // Filter to only relationships that produce an empty inverse
    const emptyInverseArb = fc
      .record({
        relation: fc.constantFrom(...VALID_RELATIONSHIPS),
        sex: sexArb,
      })
      .filter(({ relation, sex }) => {
        const inv = RELATIONSHIP_INVERSE_MAP[relation]?.[sex];
        return inv === "";
      });

    fc.assert(
      fc.property(emptyInverseArb, ({ relation, sex }) => {
        const inverse = getInverseRelationship(relation, sex);

        // Simulate what createFamilyRelation stores
        const relationAToB = relation;
        const relationBToA = inverse;

        // Forward must be the original relationship
        expect(relationAToB).toBe(relation);
        // Reverse must be empty
        expect(relationBToA).toBe("");
      }),
      { numRuns: 100 }
    );
  });

  it("forward and reverse are always consistent with the inverse map for any valid input", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_RELATIONSHIPS),
        sexArb,
        (relation, sex) => {
          const inverse = getInverseRelationship(relation, sex);

          // The stored row would have:
          const relationAToB = relation;
          const relationBToA = inverse;

          // Forward is always the original
          expect(relationAToB).toBe(relation);
          // Reverse always matches the map lookup
          expect(relationBToA).toBe(
            RELATIONSHIP_INVERSE_MAP[relation]?.[sex] ?? ""
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
