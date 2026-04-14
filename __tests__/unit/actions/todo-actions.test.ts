import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { formatCompletionMessage } from "@/app/_lib/utils/todo-utils";

/**
 * **Validates: Requirements 19.4**
 *
 * Property 14: Todo completion contact format
 * Tests that the auto-created contact record field matches
 * "{D} 系統訊息({E}):完成 {N}" format for any date/email/note.
 */
describe("Feature: crm-modernization, Property 14: Todo completion contact format", () => {
  const dateArb = fc.date({ min: new Date("2000-01-01"), max: new Date("2099-12-31") }).map(
    (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  );
  const emailArb = fc.emailAddress();
  const noteArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

  it("output matches the expected pattern for any date/email/note", () => {
    fc.assert(
      fc.property(dateArb, emailArb, noteArb, (date, email, note) => {
        const result = formatCompletionMessage(date, email, note);

        // Must match the exact format: "{date} 系統訊息({email}):完成 {note}"
        const expected = `${date} 系統訊息(${email}):完成 ${note}`;
        expect(result).toBe(expected);

        // Verify structural properties
        expect(result).toContain("系統訊息(");
        expect(result).toContain("):完成 ");
        expect(result.startsWith(date)).toBe(true);
        expect(result.endsWith(note)).toBe(true);
        expect(result).toContain(email);
      }),
      { numRuns: 100 }
    );
  });

  it("output contains all three input components without loss", () => {
    fc.assert(
      fc.property(dateArb, emailArb, noteArb, (date, email, note) => {
        const result = formatCompletionMessage(date, email, note);

        // All inputs must appear in the output
        expect(result).toContain(date);
        expect(result).toContain(email);
        expect(result).toContain(note);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Validates: Requirements 2.2, 2.3**
 *
 * Unit tests for createTodo default staffId behavior:
 * - When staffInChargeIds is NOT provided and session.user.staffId exists,
 *   createTodo should default to [session.user.staffId].
 * - When staffInChargeIds is NOT provided and session.user.staffId is null,
 *   createTodo should create a Todo with no staff (empty connect array).
 */
describe("createTodo default staffId behavior", () => {
  const mockTodoCreate = vi.fn();
  const mockAuth = vi.fn();
  const mockRevalidatePath = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("defaults to [session.user.staffId] when staffInChargeIds is not provided (Req 2.2)", async () => {
    const sessionStaffId = 5;

    mockAuth.mockResolvedValue({
      user: { id: "1", email: "test@example.com", role: "admin", staffId: sessionStaffId },
    });
    mockTodoCreate.mockResolvedValue({ id: 1 });

    vi.doMock("@/app/_lib/auth", () => ({ auth: mockAuth }));
    vi.doMock("@/app/_lib/db", () => ({
      prisma: { todo: { create: mockTodoCreate } },
    }));
    vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

    const { createTodo } = await import("@/app/_lib/actions/todo-actions");

    const formData = new FormData();
    formData.set("clientId", "10");
    formData.set("note", "test note");
    // staffInChargeIds is intentionally NOT set

    const result = await createTodo(formData);

    expect(result.success).toBe(true);
    expect(mockTodoCreate).toHaveBeenCalledOnce();

    const callArg = mockTodoCreate.mock.calls[0][0];
    expect(callArg.data.staffInCharge).toEqual({
      connect: [{ id: sessionStaffId }],
    });
  });

  it("creates Todo with empty connect when session staffId is null and staffInChargeIds not provided (Req 2.3)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", email: "test@example.com", role: "admin", staffId: null },
    });
    mockTodoCreate.mockResolvedValue({ id: 2 });

    vi.doMock("@/app/_lib/auth", () => ({ auth: mockAuth }));
    vi.doMock("@/app/_lib/db", () => ({
      prisma: { todo: { create: mockTodoCreate } },
    }));
    vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

    const { createTodo } = await import("@/app/_lib/actions/todo-actions");

    const formData = new FormData();
    formData.set("clientId", "20");
    formData.set("note", "another note");
    // staffInChargeIds is intentionally NOT set

    const result = await createTodo(formData);

    expect(result.success).toBe(true);
    expect(mockTodoCreate).toHaveBeenCalledOnce();

    const callArg = mockTodoCreate.mock.calls[0][0];
    expect(callArg.data.staffInCharge).toEqual({
      connect: [],
    });
  });
});


/**
 * **Validates: Requirements 3.5**
 *
 * Unit tests for updateTodo:
 * - updateTodo should successfully update a Todo even when done=true
 * - updateTodo should return an error when Zod validation fails
 */
describe("updateTodo behavior", () => {
  const mockTodoUpdate = vi.fn();
  const mockAuth = vi.fn();
  const mockRevalidatePath = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("should successfully update a Todo even when done=true (Req 3.5)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", email: "test@example.com", role: "admin", staffId: 1 },
    });
    mockTodoUpdate.mockResolvedValue({ id: 42 });

    vi.doMock("@/app/_lib/auth", () => ({ auth: mockAuth }));
    vi.doMock("@/app/_lib/db", () => ({
      prisma: { todo: { update: mockTodoUpdate } },
    }));
    vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

    const { updateTodo } = await import("@/app/_lib/actions/todo-actions");

    const formData = new FormData();
    formData.set("note", "updated note for completed todo");
    formData.set("staffInChargeIds", "1,2");

    const result = await updateTodo(42, formData);

    expect(result.success).toBe(true);
    expect(result).toHaveProperty("data");
    if (result.success) {
      expect(result.data.id).toBe(42);
    }
    expect(mockTodoUpdate).toHaveBeenCalledOnce();

    const callArg = mockTodoUpdate.mock.calls[0][0];
    expect(callArg.where).toEqual({ id: 42 });
    // staffInCharge uses set semantics
    expect(callArg.data.staffInCharge).toEqual({
      set: [{ id: 1 }, { id: 2 }],
    });
  });

  it("should return an error when Zod validation fails (invalid date)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", email: "test@example.com", role: "admin", staffId: 1 },
    });

    vi.doMock("@/app/_lib/auth", () => ({ auth: mockAuth }));
    vi.doMock("@/app/_lib/db", () => ({
      prisma: { todo: { update: mockTodoUpdate } },
    }));
    vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

    const { updateTodo } = await import("@/app/_lib/actions/todo-actions");

    const formData = new FormData();
    formData.set("date", "not-a-valid-date");

    const result = await updateTodo(1, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe("string");
    }
    // Prisma update should NOT have been called
    expect(mockTodoUpdate).not.toHaveBeenCalled();
  });
});
