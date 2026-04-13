import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Pure functions extracted for testability — mirrors the logic
 * used by the home page to filter and sort todos.
 */
interface Todo {
  id: number;
  date: Date | null;
  done: boolean;
  note: string | null;
  clientId: number;
}

function filterUndoneTodos(todos: Todo[]): Todo[] {
  return todos.filter((t) => !t.done);
}

function sortTodosByDateAsc(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const da = a.date?.getTime() ?? 0;
    const db = b.date?.getTime() ?? 0;
    return da - db;
  });
}

/**
 * **Validates: Requirements 19.1**
 *
 * Property 13: Todo list filter and sort
 * - Only todos with done=false appear
 * - Sorted by date ASC
 */
describe("Feature: crm-modernization, Property 13: Todo list filter and sort", () => {
  const todoArb = fc.record({
    id: fc.nat(),
    date: fc.option(
      fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
      { nil: null }
    ),
    done: fc.boolean(),
    note: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
    clientId: fc.nat({ max: 1000 }),
  });

  const todosArb = fc.array(todoArb, { minLength: 0, maxLength: 50 });

  it("only todos with done=false appear in the filtered list", () => {
    fc.assert(
      fc.property(todosArb, (todos) => {
        const result = filterUndoneTodos(todos);

        // Every item in result must have done=false
        for (const t of result) {
          expect(t.done).toBe(false);
        }

        // Count must match the number of undone todos in input
        const expectedCount = todos.filter((t) => !t.done).length;
        expect(result.length).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  it("no completed todo appears in the filtered list", () => {
    // Use unique IDs by mapping index
    const uniqueTodosArb = todosArb.map((todos) =>
      todos.map((t, i) => ({ ...t, id: i }))
    );

    fc.assert(
      fc.property(uniqueTodosArb, (todos) => {
        const result = filterUndoneTodos(todos);
        const doneIds = new Set(todos.filter((t) => t.done).map((t) => t.id));

        for (const t of result) {
          expect(doneIds.has(t.id)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("filtered todos are sorted by date ascending", () => {
    fc.assert(
      fc.property(todosArb, (todos) => {
        const filtered = filterUndoneTodos(todos);
        const sorted = sortTodosByDateAsc(filtered);

        for (let i = 1; i < sorted.length; i++) {
          const prevDate = sorted[i - 1].date?.getTime() ?? 0;
          const currDate = sorted[i].date?.getTime() ?? 0;
          expect(prevDate).toBeLessThanOrEqual(currDate);
        }
      }),
      { numRuns: 100 }
    );
  });
});
