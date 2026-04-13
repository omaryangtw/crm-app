import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  getInverseRelationship,
  RELATIONSHIP_INVERSE_MAP,
  VALID_RELATIONSHIPS,
} from "@/app/_lib/constants/relationship-map";

/**
 * **Validates: Requirements 17.2, 17.3, 17.4**
 *
 * Property 11: Relationship inverter correctness
 * For any valid relationship type and source sex, getInverseRelationship
 * returns the value from the map. For unknown types, returns "".
 */
describe("Feature: crm-modernization, Property 11: Relationship inverter correctness", () => {
  it("returns correct inverse for male source across all valid relationships", () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_RELATIONSHIPS), (relation) => {
        const result = getInverseRelationship(relation, "male");
        const expected = RELATIONSHIP_INVERSE_MAP[relation]["male"];
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it("returns correct inverse for female source across all valid relationships", () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_RELATIONSHIPS), (relation) => {
        const result = getInverseRelationship(relation, "female");
        const expected = RELATIONSHIP_INVERSE_MAP[relation]["female"];
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it("returns empty string for unknown relationship types", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !VALID_RELATIONSHIPS.includes(s)),
        fc.constantFrom("male" as const, "female" as const),
        (unknownRelation, sex) => {
          const result = getInverseRelationship(unknownRelation, sex);
          expect(result).toBe("");
        }
      ),
      { numRuns: 100 }
    );
  });
});
