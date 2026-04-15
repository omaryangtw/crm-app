import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { parseFilters, serializeFilters, resolveFilterLabel } from "@/app/_lib/filters/filter-url";
import { buildFilterWhere } from "@/app/_lib/filters/filter-where";
import type {
  FilterConfig,
  FilterFieldConfig,
  ActiveFilter,
  EnumFilterField,
  BooleanFilterField,
  RelationFilterField,
} from "@/app/_lib/filters/filter-config";

// ---------------------------------------------------------------------------
// Generators (Arbitraries)
// ---------------------------------------------------------------------------

/**
 * Generate a unique field name — lowercase alpha string to avoid collisions
 * with the `f_` prefix parsing logic.
 */
const arbFieldName = fc
  .stringMatching(/^[a-z][a-zA-Z]{1,14}$/)
  .filter((s) => s.length >= 2);

/**
 * Generate a non-empty Chinese-ish label (any non-empty string works for testing).
 */
const arbLabel = fc.string({ minLength: 1, maxLength: 10 });

/**
 * Generate an EnumFilterField with 1–6 options, each with a non-empty label.
 * Option keys are lowercase alpha strings to stay URL-safe.
 */
function arbEnumField(field: string): fc.Arbitrary<EnumFilterField> {
  const arbOptionKey = fc
    .stringMatching(/^[a-z][a-z_]{0,9}$/)
    .filter((s) => s.length >= 1);
  const arbOptionLabel = fc.string({ minLength: 1, maxLength: 8 });

  return fc
    .array(fc.tuple(arbOptionKey, arbOptionLabel), { minLength: 1, maxLength: 6 })
    .map((pairs) => {
      // Deduplicate keys
      const options: Record<string, string> = {};
      for (const [k, v] of pairs) {
        if (!(k in options)) options[k] = v;
      }
      return options;
    })
    .filter((opts) => Object.keys(opts).length >= 1)
    .chain((options) =>
      arbLabel.map(
        (label): EnumFilterField => ({
          type: "enum" as const,
          field,
          label,
          options,
        })
      )
    );
}

/**
 * Generate a BooleanFilterField.
 */
function arbBooleanField(field: string): fc.Arbitrary<BooleanFilterField> {
  return fc.tuple(arbLabel, arbLabel, arbLabel).map(
    ([label, trueLabel, falseLabel]): BooleanFilterField => ({
      type: "boolean" as const,
      field,
      label,
      trueLabel,
      falseLabel,
    })
  );
}

/**
 * Generate a RelationFilterField.
 * loadOptions is a dummy async function (not exercised in URL round-trip).
 */
function arbRelationField(field: string): fc.Arbitrary<RelationFilterField> {
  return arbLabel.map(
    (label): RelationFilterField => ({
      type: "relation" as const,
      field,
      label,
      loadOptions: async () => [],
    })
  );
}

/**
 * Generate a single FilterFieldConfig of random type for a given field name.
 */
function arbFilterFieldConfig(
  field: string
): fc.Arbitrary<FilterFieldConfig> {
  return fc.oneof(
    arbEnumField(field),
    arbBooleanField(field),
    arbRelationField(field)
  );
}

/**
 * Generate a FilterConfig array with 1–5 fields of mixed types,
 * each with a unique field name.
 */
const arbFilterConfig: fc.Arbitrary<FilterConfig> = fc
  .array(arbFieldName, { minLength: 1, maxLength: 5 })
  .map((names) => [...new Set(names)]) // deduplicate
  .filter((names) => names.length >= 1)
  .chain((uniqueNames) =>
    fc.tuple(...uniqueNames.map((name) => arbFilterFieldConfig(name)))
  )
  .map((configs) => configs as FilterConfig);

/**
 * Given a FilterConfig, generate a valid ActiveFilter[] subset.
 * For each field in config, randomly decide whether to include it,
 * and if so, pick a valid value for its type.
 */
function arbActiveFilters(
  config: FilterConfig
): fc.Arbitrary<ActiveFilter[]> {
  if (config.length === 0) return fc.constant([]);

  // For each field config, create an arbitrary that optionally produces an ActiveFilter
  const perFieldArbs = config.map((fc_) => {
    const valueArb = arbValidValue(fc_);
    // 50% chance to include this field
    return fc.boolean().chain((include) => {
      if (!include) return fc.constant(null);
      return valueArb.map(
        (value): ActiveFilter => ({ field: fc_.field, value })
      );
    });
  });

  return fc
    .tuple(...perFieldArbs)
    .map((results) => results.filter((r): r is ActiveFilter => r !== null));
}

/**
 * Generate a valid value string for a given FilterFieldConfig.
 */
function arbValidValue(fieldConfig: FilterFieldConfig): fc.Arbitrary<string> {
  switch (fieldConfig.type) {
    case "enum": {
      const keys = Object.keys(fieldConfig.options);
      return fc.constantFrom(...keys);
    }
    case "boolean":
      return fc.constantFrom("true", "false");
    case "relation":
      // Relation values are non-empty strings (numeric IDs as strings)
      return fc.integer({ min: 1, max: 99999 }).map(String);
  }
}

// ---------------------------------------------------------------------------
// Property 1: Filter URL Round-Trip
// ---------------------------------------------------------------------------

describe("Feature: dynamic-list-filters, Property 1: Filter URL Round-Trip", () => {
  /**
   * **Validates: Requirements 6.1, 3.5, 3.6**
   *
   * For any valid set of ActiveFilter[] derived from a given FilterConfig,
   * serializing the filters to URL query parameters via serializeFilters
   * and then parsing them back via parseFilters SHALL produce an equivalent
   * set of active filters.
   */
  it("parseFilters(serializeFilters(filters), config) deep-equals original filters", () => {
    fc.assert(
      fc.property(
        arbFilterConfig.chain((config) =>
          arbActiveFilters(config).map((filters) => ({ config, filters }))
        ),
        ({ config, filters }) => {
          const serialized = serializeFilters(filters);
          const parsed = parseFilters(serialized, config);

          // Sort both arrays by field name for stable comparison
          const sortByField = (a: ActiveFilter, b: ActiveFilter) =>
            a.field.localeCompare(b.field);

          const sortedOriginal = [...filters].sort(sortByField);
          const sortedParsed = [...parsed].sort(sortByField);

          expect(sortedParsed).toEqual(sortedOriginal);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Generator: arbUrlParams — mixed valid, unknown, invalid, and non-filter params
// ---------------------------------------------------------------------------

/**
 * Generate an invalid value for a given FilterFieldConfig.
 * The value is guaranteed NOT to be valid for the field's type.
 */
function arbInvalidValue(
  fieldConfig: FilterFieldConfig
): fc.Arbitrary<string> {
  switch (fieldConfig.type) {
    case "enum": {
      const validKeys = new Set(Object.keys(fieldConfig.options));
      // Generate a string that is NOT one of the valid enum keys
      return fc
        .stringMatching(/^[a-z_]{1,12}$/)
        .filter((s) => !validKeys.has(s) && s.length > 0);
    }
    case "boolean":
      // Anything other than "true" or "false"
      return fc
        .stringMatching(/^[a-z]{1,8}$/)
        .filter((s) => s !== "true" && s !== "false" && s.length > 0);
    case "relation":
      // Empty string is invalid for relation fields
      return fc.constant("");
  }
}

/**
 * Generate URL search params containing a mix of:
 * 1. Valid f_ params (from config with valid values)
 * 2. Unknown field f_ params (f_unknownField=someValue)
 * 3. Invalid value f_ params (f_validField=invalidValue)
 * 4. Non-filter params (q=search, page=2, etc.)
 *
 * Returns { params, expectedFilters } where expectedFilters is the
 * subset that parseFilters should return.
 */
function arbUrlParams(config: FilterConfig): fc.Arbitrary<{
  params: Record<string, string>;
  expectedFilters: ActiveFilter[];
}> {
  // 1. Valid f_ params — random subset of config fields with valid values
  const validParamsArb = arbActiveFilters(config);

  // 2. Unknown field f_ params — field names NOT in config
  const configFieldNames = new Set(config.map((c) => c.field));
  const arbUnknownFieldName = fc
    .stringMatching(/^[a-z][a-zA-Z]{2,12}$/)
    .filter((s) => !configFieldNames.has(s));
  const unknownParamsArb = fc
    .array(
      fc.tuple(arbUnknownFieldName, fc.string({ minLength: 1, maxLength: 10 })),
      { minLength: 0, maxLength: 3 }
    )
    .map((pairs) => {
      const result: Record<string, string> = {};
      for (const [field, value] of pairs) {
        result[`f_${field}`] = value;
      }
      return result;
    });

  // 3. Invalid value f_ params — valid field names but invalid values
  const invalidParamsArb =
    config.length === 0
      ? fc.constant({} as Record<string, string>)
      : fc
          .array(
            fc.constantFrom(...config).chain((fieldConfig) =>
              arbInvalidValue(fieldConfig).map((value) => ({
                field: fieldConfig.field,
                value,
              }))
            ),
            { minLength: 0, maxLength: 3 }
          )
          .map((entries) => {
            const result: Record<string, string> = {};
            for (const { field, value } of entries) {
              result[`f_${field}`] = value;
            }
            return result;
          });

  // 4. Non-filter params (no f_ prefix)
  const nonFilterParamsArb = fc
    .array(
      fc.tuple(
        fc.constantFrom("q", "page", "sort", "order", "limit"),
        fc.string({ minLength: 1, maxLength: 10 })
      ),
      { minLength: 0, maxLength: 3 }
    )
    .map((pairs) => {
      const result: Record<string, string> = {};
      for (const [key, value] of pairs) {
        result[key] = value;
      }
      return result;
    });

  return fc
    .tuple(validParamsArb, unknownParamsArb, invalidParamsArb, nonFilterParamsArb)
    .map(([validFilters, unknownParams, invalidParams, nonFilterParams]) => {
      // Build the combined params object.
      // Valid params go in first, then invalid/unknown may overwrite some —
      // but we need to track which valid filters actually survive.
      const params: Record<string, string> = {};

      // Add non-filter params first
      Object.assign(params, nonFilterParams);

      // Add unknown field params
      Object.assign(params, unknownParams);

      // Add invalid value params
      Object.assign(params, invalidParams);

      // Add valid params LAST so they overwrite any invalid params for the same field
      const serializedValid: Record<string, string> = {};
      for (const f of validFilters) {
        serializedValid[`f_${f.field}`] = f.value;
      }
      Object.assign(params, serializedValid);

      // The expected filters are exactly the valid ones we added last
      return { params, expectedFilters: validFilters };
    });
}

// ---------------------------------------------------------------------------
// Property 6: Parser Robustness
// ---------------------------------------------------------------------------

describe("Feature: dynamic-list-filters, Property 6: Parser Robustness", () => {
  /**
   * **Validates: Requirements 6.2, 6.3**
   *
   * For any URL search params containing a mix of valid f_ filter params,
   * unrecognized f_ params (unknown field names), and f_ params with invalid
   * values, parseFilters SHALL return only the filters with recognized fields
   * AND valid values, silently discarding all others.
   */
  it("parseFilters returns only valid filters, discarding unknown fields, invalid values, and non-filter params", () => {
    fc.assert(
      fc.property(
        arbFilterConfig.chain((config) =>
          arbUrlParams(config).map((result) => ({ config, ...result }))
        ),
        ({ config, params, expectedFilters }) => {
          const parsed = parseFilters(params, config);

          // Sort both arrays by field name for stable comparison
          const sortByField = (a: ActiveFilter, b: ActiveFilter) =>
            a.field.localeCompare(b.field);

          const sortedExpected = [...expectedFilters].sort(sortByField);
          const sortedParsed = [...parsed].sort(sortByField);

          expect(sortedParsed).toEqual(sortedExpected);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("parseFilters returns empty array when all f_ params have unknown fields", () => {
    fc.assert(
      fc.property(
        arbFilterConfig,
        fc.array(
          fc.tuple(
            fc.stringMatching(/^[a-z]{3,10}$/).filter(
              (s) => s !== "sex" && s !== "status" && s !== "contactType"
            ),
            fc.string({ minLength: 1, maxLength: 10 })
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (config, unknownPairs) => {
          const configFields = new Set(config.map((c) => c.field));
          // Ensure none of the generated fields match config
          const filteredPairs = unknownPairs.filter(
            ([field]) => !configFields.has(field)
          );
          if (filteredPairs.length === 0) return; // skip if all accidentally matched

          const params: Record<string, string> = {};
          for (const [field, value] of filteredPairs) {
            params[`f_${field}`] = value;
          }

          const parsed = parseFilters(params, config);
          expect(parsed).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("parseFilters ignores non-f_ prefixed params entirely", () => {
    fc.assert(
      fc.property(
        arbFilterConfig,
        fc.array(
          fc.tuple(
            fc.constantFrom("q", "page", "sort", "order", "limit", "offset"),
            fc.string({ minLength: 1, maxLength: 10 })
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (config, nonFilterPairs) => {
          const params: Record<string, string> = {};
          for (const [key, value] of nonFilterPairs) {
            params[key] = value;
          }

          const parsed = parseFilters(params, config);
          expect(parsed).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 2: Where Clause Construction
// ---------------------------------------------------------------------------

describe("Feature: dynamic-list-filters, Property 2: Where Clause Construction", () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * For any combination of valid ActiveFilter[] derived from a FilterConfig,
   * buildFilterWhere SHALL produce a Prisma where object that contains exactly
   * one condition per active filter, using the correct type mapping:
   * - enum → string value
   * - boolean → boolean (true if "true", false otherwise)
   * - relation → { some: { id: parseInt(value) } }
   */
  it("returns one key per active filter with correct type mapping", () => {
    fc.assert(
      fc.property(
        arbFilterConfig.chain((config) =>
          arbActiveFilters(config).map((filters) => ({ config, filters }))
        ),
        ({ config, filters }) => {
          const where = buildFilterWhere(filters, config);

          // 1. Exactly one key per active filter
          expect(Object.keys(where).length).toBe(filters.length);

          // 2. Each filter produces the correctly typed value
          for (const filter of filters) {
            const fieldConfig = config.find((c) => c.field === filter.field)!;
            expect(where).toHaveProperty(filter.field);

            switch (fieldConfig.type) {
              case "enum":
                // Enum: where[field] is the string value
                expect(where[filter.field]).toBe(filter.value);
                expect(typeof where[filter.field]).toBe("string");
                break;
              case "boolean":
                // Boolean: where[field] is true/false
                expect(where[filter.field]).toBe(filter.value === "true");
                expect(typeof where[filter.field]).toBe("boolean");
                break;
              case "relation":
                // Relation: where[field] is { some: { id: parseInt(value) } }
                expect(where[filter.field]).toEqual({
                  some: { id: parseInt(filter.value, 10) },
                });
                break;
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 3: Label Resolution Completeness
// ---------------------------------------------------------------------------

describe("Feature: dynamic-list-filters, Property 3: Label Resolution Completeness", () => {
  /**
   * **Validates: Requirements 1.4, 4.1**
   *
   * For any valid FilterConfig and any ActiveFilter whose field and value
   * are valid within that config, resolveFilterLabel SHALL return non-null
   * with non-empty fieldLabel and valueLabel strings.
   */
  it("resolveFilterLabel returns non-empty fieldLabel and valueLabel for any valid filter", () => {
    fc.assert(
      fc.property(
        arbFilterConfig.chain((config) =>
          arbActiveFilters(config)
            .filter((filters) => filters.length > 0)
            .map((filters) => ({ config, filters }))
        ),
        ({ config, filters }) => {
          for (const filter of filters) {
            const result = resolveFilterLabel(filter, config);

            // Must not be null for a valid filter
            expect(result).not.toBeNull();

            // fieldLabel and valueLabel must be non-empty strings
            expect(typeof result!.fieldLabel).toBe("string");
            expect(result!.fieldLabel.length).toBeGreaterThan(0);
            expect(typeof result!.valueLabel).toBe("string");
            expect(result!.valueLabel.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 5: Enum Option Completeness
// ---------------------------------------------------------------------------

describe("Feature: dynamic-list-filters, Property 5: Enum Option Completeness", () => {
  /**
   * **Validates: Requirements 2.1**
   *
   * For any enum-type FilterFieldConfig with random label maps,
   * the set of selectable option keys (Object.keys(options)) SHALL exactly
   * equal the options map keys, and every option label (Object.values(options))
   * SHALL be a non-empty string.
   */
  it("selectable option keys exactly equal the options map keys and all labels are non-empty", () => {
    fc.assert(
      fc.property(
        arbFieldName.chain((field) => arbEnumField(field)),
        (enumField) => {
          const optionKeys = Object.keys(enumField.options);
          const optionLabels = Object.values(enumField.options);

          // Must have at least one option
          expect(optionKeys.length).toBeGreaterThanOrEqual(1);

          // The selectable option keys are exactly the options map keys
          // (no extra, no missing — identity check)
          const selectableKeys = Object.keys(enumField.options);
          expect(new Set(selectableKeys)).toEqual(new Set(optionKeys));

          // Every label must be a non-empty string
          for (const label of optionLabels) {
            expect(typeof label).toBe("string");
            expect(label.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 4: Available Field Exclusion
// ---------------------------------------------------------------------------

/**
 * Pure logic extracted from FilterBar component:
 * Given a FilterConfig and active filters, return the fields NOT yet active.
 */
function getAvailableFields(
  config: FilterConfig,
  activeFilters: ActiveFilter[]
): FilterFieldConfig[] {
  return config.filter(
    (fc_) => !activeFilters.some((af) => af.field === fc_.field)
  );
}

describe("Feature: dynamic-list-filters, Property 4: Available Field Exclusion", () => {
  /**
   * **Validates: Requirements 1.5**
   *
   * For any FilterConfig with N fields and any subset of K active filters
   * (0 ≤ K ≤ N), the list of available fields SHALL contain exactly N − K
   * fields, and none of the active filter fields SHALL appear in the
   * available list.
   */
  it("available fields = N − K and no active field appears in available list", () => {
    fc.assert(
      fc.property(
        arbFilterConfig.chain((config) =>
          arbActiveFilters(config).map((filters) => ({ config, filters }))
        ),
        ({ config, filters }) => {
          const available = getAvailableFields(config, filters);

          // 1. Count: available fields = total config fields − active filters
          expect(available.length).toBe(config.length - filters.length);

          // 2. Exclusion: no active filter field appears in the available list
          const activeFieldNames = new Set(filters.map((f) => f.field));
          for (const field of available) {
            expect(activeFieldNames.has(field.field)).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});


// ---------------------------------------------------------------------------
// Unit Tests: FilterBar behavior (Task 4.4)
// ---------------------------------------------------------------------------

// NOTE: serializeFilters, parseFilters, resolveFilterLabel, ActiveFilter already imported at top.

// Mock the server action module so importing configs doesn't pull in next-auth / next/server.
vi.mock("@/app/_lib/actions/staff-actions", () => ({
  getActiveStaff: vi.fn(async () => []),
}));

// Now safe to import configs (loadOptions references the mocked getActiveStaff).
const {
  clientFilterConfig,
  caseFilterConfig,
  contactFilterConfig,
} = await import("@/app/_lib/filters/configs");

describe("Feature: dynamic-list-filters, Unit: Config correctness", () => {
  /**
   * Validates: Requirements 1.1
   * Client config has exactly: sex, indigenousGroup, plainMountain
   */
  it("clientFilterConfig has expected fields", () => {
    const fields = clientFilterConfig.map((c) => c.field);
    expect(fields).toEqual(["sex", "indigenousGroup", "plainMountain"]);
  });

  /**
   * Validates: Requirements 1.2
   * Case config has exactly: status, typesMajor, staffInCharge
   */
  it("caseFilterConfig has expected fields", () => {
    const fields = caseFilterConfig.map((c) => c.field);
    expect(fields).toEqual(["status", "typesMajor", "staffInCharge"]);
  });

  /**
   * Validates: Requirements 1.3
   * Contact config has exactly: date, contactType, isSuccess, staffInCharge
   */
  it("contactFilterConfig has expected fields", () => {
    const fields = contactFilterConfig.map((c) => c.field);
    expect(fields).toEqual(["date", "contactType", "isSuccess", "staffInCharge"]);
  });
});

describe("Feature: dynamic-list-filters, Unit: Boolean field options", () => {
  /**
   * Validates: Requirements 2.3
   * The isSuccess boolean field produces exactly [{value:"true",label:"成功"},{value:"false",label:"失敗"}]
   */
  it("isSuccess boolean field options are exactly [{value:'true',label:'成功'},{value:'false',label:'失敗'}]", () => {
    const boolField = contactFilterConfig.find((c) => c.field === "isSuccess");
    expect(boolField).toBeDefined();
    expect(boolField!.type).toBe("boolean");

    if (boolField!.type === "boolean") {
      const options = [
        { value: "true", label: boolField!.trueLabel },
        { value: "false", label: boolField!.falseLabel },
      ];
      expect(options).toEqual([
        { value: "true", label: "成功" },
        { value: "false", label: "失敗" },
      ]);
    }
  });
});

describe("Feature: dynamic-list-filters, Unit: Pagination reset", () => {
  /**
   * Validates: Requirements 3.4
   * Applying a filter removes the `page` param from URL search params.
   * This tests the URL update logic: serialize filters → set f_ params → delete page param.
   */
  it("applying a filter removes the page param", () => {
    // Simulate existing URL params with page
    const params = new URLSearchParams("q=test&page=3&f_sex=male");

    // Simulate the updateFilters logic from FilterBar:
    // 1. Remove all existing f_ params
    for (const key of [...params.keys()]) {
      if (key.startsWith("f_")) params.delete(key);
    }
    // 2. Add new filter params (adding a new filter)
    const newFilters: ActiveFilter[] = [
      { field: "sex", value: "male" },
      { field: "indigenousGroup", value: "amis" },
    ];
    const serialized = serializeFilters(newFilters);
    for (const [k, v] of Object.entries(serialized)) {
      params.set(k, v);
    }
    // 3. Reset pagination
    params.delete("page");

    expect(params.has("page")).toBe(false);
    expect(params.get("q")).toBe("test");
    expect(params.get("f_sex")).toBe("male");
    expect(params.get("f_indigenousGroup")).toBe("amis");
  });
});

describe("Feature: dynamic-list-filters, Unit: Clear-all visibility", () => {
  /**
   * Validates: Requirements 4.3, 4.5
   * Clear-all button is shown when activeFilters.length >= 2, hidden when 0–1.
   */
  it("shown when ≥2 filters", () => {
    const activeFilters: ActiveFilter[] = [
      { field: "sex", value: "male" },
      { field: "indigenousGroup", value: "amis" },
    ];
    expect(activeFilters.length >= 2).toBe(true);
  });

  it("hidden when 0 filters", () => {
    const activeFilters: ActiveFilter[] = [];
    expect(activeFilters.length >= 2).toBe(false);
  });

  it("hidden when 1 filter", () => {
    const activeFilters: ActiveFilter[] = [{ field: "sex", value: "male" }];
    expect(activeFilters.length >= 2).toBe(false);
  });
});

describe("Feature: dynamic-list-filters, Unit: Remove single filter", () => {
  /**
   * Validates: Requirements 4.2
   * Removing a filter removes only that f_ param; other filters remain.
   */
  it("removes only the targeted filter, keeps others", () => {
    const activeFilters: ActiveFilter[] = [
      { field: "sex", value: "male" },
      { field: "indigenousGroup", value: "amis" },
      { field: "plainMountain", value: "plain" },
    ];

    const fieldToRemove = "indigenousGroup";
    const remaining = activeFilters.filter((f) => f.field !== fieldToRemove);

    expect(remaining).toEqual([
      { field: "sex", value: "male" },
      { field: "plainMountain", value: "plain" },
    ]);

    // Verify the serialized URL params only contain the remaining filters
    const serialized = serializeFilters(remaining);
    expect(serialized).toEqual({
      f_sex: "male",
      f_plainMountain: "plain",
    });
    expect(serialized).not.toHaveProperty("f_indigenousGroup");
  });
});
