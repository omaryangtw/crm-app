import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { formatCompletionMessage, filterTodos, formatStaffNames } from "@/app/_lib/utils/todo-utils";

/**
 * **Validates: Requirements 2.1**
 *
 * Property 1: createTodo connects specified staff
 *
 * For any valid set of staff IDs and a valid clientId, calling createTodo
 * with those staffInChargeIds should result in prisma.todo.create being
 * called with staffInCharge.connect containing exactly those staff IDs.
 */
describe("Feature: todo-enhancement, Property 1: createTodo connects specified staff", () => {
  const mockTodoCreate = vi.fn();
  const mockAuth = vi.fn();
  const mockRevalidatePath = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();

    mockAuth.mockResolvedValue({
      user: { id: "1", email: "test@example.com", role: "admin", staffId: 99 },
    });

    mockTodoCreate.mockResolvedValue({ id: 1 });
  });

  it("prisma.todo.create receives staffInCharge.connect with the exact staff IDs from input", async () => {
    vi.doMock("@/app/_lib/auth", () => ({ auth: mockAuth }));
    vi.doMock("@/app/_lib/db", () => ({
      prisma: {
        todo: { create: mockTodoCreate },
      },
    }));
    vi.doMock("next/cache", () => ({
      revalidatePath: mockRevalidatePath,
    }));

    const { createTodo } = await import(
      "@/app/_lib/actions/todo-actions"
    );

    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 100000 }),
        async (staffIds, clientId) => {
          mockTodoCreate.mockClear();
          mockTodoCreate.mockResolvedValue({ id: 1 });

          const formData = new FormData();
          formData.set("clientId", String(clientId));
          formData.set("staffInChargeIds", staffIds.join(","));

          const result = await createTodo(formData);

          expect(result.success).toBe(true);
          expect(mockTodoCreate).toHaveBeenCalledOnce();

          const callArg = mockTodoCreate.mock.calls[0][0];
          const connectArray = callArg.data.staffInCharge.connect;

          // The connect array must contain exactly the provided staff IDs
          const connectedIds = connectArray.map((c: { id: number }) => c.id);
          expect(connectedIds).toEqual(staffIds);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 3.1, 3.2**
 *
 * Property 2: updateTodo set semantics replaces staff
 *
 * For any existing Todo ID and any new set of valid staff IDs, calling
 * updateTodo with those staffInChargeIds should result in prisma.todo.update
 * being called with staffInCharge.set containing exactly the new staff IDs,
 * replacing all previous associations.
 */
describe("Feature: todo-enhancement, Property 2: updateTodo set semantics replaces staff", () => {
  const mockTodoUpdate = vi.fn();
  const mockAuth = vi.fn();
  const mockRevalidatePath = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();

    mockAuth.mockResolvedValue({
      user: { id: "1", email: "test@example.com", role: "admin", staffId: 99 },
    });

    mockTodoUpdate.mockResolvedValue({ id: 1 });
  });

  it("prisma.todo.update receives staffInCharge.set with the exact new staff IDs from input", async () => {
    vi.doMock("@/app/_lib/auth", () => ({ auth: mockAuth }));
    vi.doMock("@/app/_lib/db", () => ({
      prisma: {
        todo: { update: mockTodoUpdate },
      },
    }));
    vi.doMock("next/cache", () => ({
      revalidatePath: mockRevalidatePath,
    }));

    const { updateTodo } = await import(
      "@/app/_lib/actions/todo-actions"
    );

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 10 }),
        async (todoId, newStaffIds) => {
          mockTodoUpdate.mockClear();
          mockTodoUpdate.mockResolvedValue({ id: todoId });

          const formData = new FormData();
          formData.set("staffInChargeIds", newStaffIds.join(","));

          const result = await updateTodo(todoId, formData);

          expect(result.success).toBe(true);
          expect(mockTodoUpdate).toHaveBeenCalledOnce();

          const callArg = mockTodoUpdate.mock.calls[0][0];

          // Verify set semantics: staffInCharge.set contains exactly the new IDs
          const setArray = callArg.data.staffInCharge.set;
          const setIds = setArray.map((s: { id: number }) => s.id);
          expect(setIds).toEqual(newStaffIds);

          // Verify the correct todo ID is targeted
          expect(callArg.where.id).toBe(todoId);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Validates: Requirements 4.3**
 *
 * Property 3: completeTodo syncs staffInCharge to Contact
 *
 * For any uncompleted Todo with an arbitrary set of staffInCharge,
 * calling completeTodo should create a Contact record whose
 * staffInCharge.connect is identical (same set of staff IDs) to the
 * Todo's staffInCharge.
 */
describe("Feature: todo-enhancement, Property 3: completeTodo syncs staffInCharge to Contact", () => {
  const mockTodoFindUnique = vi.fn();
  const mockContactCreate = vi.fn();
  const mockTodoUpdate = vi.fn();
  const mockTransaction = vi.fn();
  const mockAuth = vi.fn();
  const mockRevalidatePath = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();

    mockAuth.mockResolvedValue({
      user: { id: "1", email: "test@example.com", role: "admin", staffId: 99 },
    });
  });

  it("prisma.contact.create receives staffInCharge.connect matching the todo's staffInCharge", async () => {
    // Each call to contact.create / todo.update returns a thenable "PrismaPromise".
    // $transaction receives the array of those thenables and resolves them.
    mockContactCreate.mockImplementation((args: unknown) => {
      // Return a thenable that resolves with a fake contact
      const p = Promise.resolve({ id: 100, ...args });
      // Store the call args so we can inspect them later
      return Object.assign(p, { [Symbol.toStringTag]: "PrismaPromise" });
    });

    mockTodoUpdate.mockImplementation((args: unknown) => {
      const p = Promise.resolve({ id: 1, done: true, ...args });
      return Object.assign(p, { [Symbol.toStringTag]: "PrismaPromise" });
    });

    // $transaction executes the array of promises
    mockTransaction.mockImplementation(async (promises: Promise<unknown>[]) => {
      return Promise.all(promises);
    });

    vi.doMock("@/app/_lib/auth", () => ({ auth: mockAuth }));
    vi.doMock("@/app/_lib/db", () => ({
      prisma: {
        todo: {
          findUnique: mockTodoFindUnique,
          update: mockTodoUpdate,
        },
        contact: {
          create: mockContactCreate,
        },
        $transaction: mockTransaction,
      },
    }));
    vi.doMock("next/cache", () => ({
      revalidatePath: mockRevalidatePath,
    }));

    const { completeTodo } = await import(
      "@/app/_lib/actions/todo-actions"
    );

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        fc.uniqueArray(
          fc.record({ id: fc.integer({ min: 1, max: 10000 }) }),
          { minLength: 0, maxLength: 10, selector: (s) => s.id }
        ),
        fc.integer({ min: 1, max: 100000 }),
        async (todoId, staffInCharge, clientId) => {
          // Reset per-iteration
          mockTodoFindUnique.mockClear();
          mockContactCreate.mockClear();
          mockTodoUpdate.mockClear();
          mockTransaction.mockClear();

          // Setup: findUnique returns an uncompleted todo with the generated staffInCharge
          mockTodoFindUnique.mockResolvedValue({
            note: "test note",
            clientId,
            done: false,
            staffInCharge,
          });

          // Re-setup thenables for each iteration
          mockContactCreate.mockImplementation(() => {
            return Promise.resolve({ id: 100 });
          });
          mockTodoUpdate.mockImplementation(() => {
            return Promise.resolve({ id: todoId, done: true });
          });
          mockTransaction.mockImplementation(async (promises: Promise<unknown>[]) => {
            return Promise.all(promises);
          });

          const result = await completeTodo(todoId);

          expect(result.success).toBe(true);

          // Verify contact.create was called exactly once
          expect(mockContactCreate).toHaveBeenCalledOnce();

          const createArg = mockContactCreate.mock.calls[0][0];
          const connectArray = createArg.data.staffInCharge.connect;

          // The connect array in contact.create must match the todo's staffInCharge
          const connectedIds = connectArray.map((c: { id: number }) => c.id);
          const expectedIds = staffInCharge.map((s: { id: number }) => s.id);
          expect(connectedIds).toEqual(expectedIds);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Validates: Requirements 4.2**
 *
 * Property 4: formatCompletionMessage preserves all components
 *
 * For any date string, email string, and note string, the output of
 * formatCompletionMessage(date, email, note) should contain the date,
 * the email, and the note as substrings, and match the pattern
 * `{date} 系統訊息({email}):完成 {note}`.
 */
describe("Feature: todo-enhancement, Property 4: formatCompletionMessage preserves all components", () => {
  it("output contains date, email, note as substrings and matches expected format", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (date: string, email: string, note: string) => {
          const result = formatCompletionMessage(date, email, note);

          // All three components must appear as substrings
          expect(result).toContain(date);
          expect(result).toContain(email);
          expect(result).toContain(note);

          // Must match the exact format
          expect(result).toBe(`${date} 系統訊息(${email}):完成 ${note}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Validates: Requirements 5.2, 5.3**
 *
 * Property 5: Todo filter correctness
 *
 * For any list of todos (each with a staffInCharge array) and for any
 * sessionStaffId:
 * - In "mine" mode, the filtered result contains exactly those todos where
 *   at least one staffInCharge member has id === sessionStaffId
 * - In "all" mode, the filtered result equals the original list
 */
describe("Feature: todo-enhancement, Property 5: Todo filter correctness", () => {
  const arbStaff = fc.record({
    id: fc.integer({ min: 1, max: 10000 }),
    name: fc.string({ minLength: 1, maxLength: 20 }),
  });

  const arbTodo = fc.record({
    id: fc.integer({ min: 1, max: 100000 }),
    staffInCharge: fc.array(arbStaff, { minLength: 0, maxLength: 5 }),
  });

  const arbTodos = fc.array(arbTodo, { minLength: 0, maxLength: 20 });
  const arbSessionStaffId = fc.integer({ min: 1, max: 10000 });

  it("'mine' mode returns exactly todos where at least one staffInCharge has id === sessionStaffId", () => {
    fc.assert(
      fc.property(arbTodos, arbSessionStaffId, (todos, sessionStaffId) => {
        const result = filterTodos(todos, sessionStaffId, "mine");

        // Expected: only todos where at least one staff member matches
        const expected = todos.filter((t) =>
          t.staffInCharge.some((s) => s.id === sessionStaffId)
        );

        expect(result).toEqual(expected);
      }),
      { numRuns: 100 }
    );
  });

  it("'all' mode returns the original list unchanged", () => {
    fc.assert(
      fc.property(arbTodos, arbSessionStaffId, (todos, sessionStaffId) => {
        const result = filterTodos(todos, sessionStaffId, "all");
        expect(result).toEqual(todos);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 *
 * Property 6: Staff name display formatting
 *
 * For any non-empty array of staff objects with name fields, the display
 * string should be the comma-separated concatenation of all names.
 * For any empty staff array, the display string should be「未指定」.
 */
describe("Feature: todo-enhancement, Property 6: Staff name display formatting", () => {
  const arbStaff = fc.record({
    id: fc.integer({ min: 1, max: 10000 }),
    name: fc.string({ minLength: 1, maxLength: 30 }),
  });

  it("non-empty staff array produces comma-separated names", () => {
    fc.assert(
      fc.property(
        fc.array(arbStaff, { minLength: 1, maxLength: 10 }),
        (staffInCharge) => {
          const result = formatStaffNames(staffInCharge);
          const expected = staffInCharge.map((s) => s.name).join(", ");
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("empty staff array returns '未指定'", () => {
    fc.assert(
      fc.property(
        fc.constant([]),
        (staffInCharge) => {
          const result = formatStaffNames(staffInCharge);
          expect(result).toBe("未指定");
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Validates: Requirements 8.3**
 *
 * Property 7: staffInChargeIds coercion round-trip
 *
 * For any array of positive integers, converting it to a comma-separated
 * string and then parsing through coerceStaffInChargeIds should produce
 * the original array.
 */
describe("Feature: todo-enhancement, Property 7: staffInChargeIds coercion round-trip", () => {
  it("positive integer array → comma string → coerceStaffInChargeIds parse → original array", async () => {
    const { coerceStaffInChargeIds } = await import(
      "@/app/_lib/schemas/contact-schema"
    );

    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 100000 }), {
          minLength: 1,
          maxLength: 20,
        }),
        (ids) => {
          const commaString = ids.join(",");
          const result = coerceStaffInChargeIds.parse(commaString);
          expect(result).toEqual(ids);
        }
      ),
      { numRuns: 100 }
    );
  });
});
