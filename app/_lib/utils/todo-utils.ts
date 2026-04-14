/**
 * Format the auto-created contact message when a todo is completed.
 * Pure function, no server dependencies — safe for unit testing.
 */
export function formatCompletionMessage(
  date: string,
  email: string,
  note: string
): string {
  return `${date} 系統訊息(${email}):完成 ${note}`;
}

/**
 * Minimum shape a todo item must have for filtering by staffInCharge.
 */
interface TodoItemForFilter {
  staffInCharge: { id: number; name: string }[];
}

/**
 * Filter todos by staffInCharge membership.
 * - "mine": keep only todos where at least one staffInCharge has the given sessionStaffId
 * - "all": return the full list unchanged
 *
 * Pure function — safe for property-based testing.
 */
export function filterTodos<T extends TodoItemForFilter>(
  todos: T[],
  sessionStaffId: number | null,
  mode: "mine" | "all"
): T[] {
  if (mode === "mine" && sessionStaffId != null) {
    return todos.filter((todo) =>
      todo.staffInCharge.some((s) => s.id === sessionStaffId)
    );
  }
  return todos;
}

/**
 * Format staff names for display.
 * - Non-empty array → comma-separated names
 * - Empty array → "未指定"
 *
 * Pure function — safe for property-based testing.
 */
export function formatStaffNames(
  staffInCharge: { id: number; name: string }[]
): string {
  if (staffInCharge.length === 0) return "未指定";
  return staffInCharge.map((s) => s.name).join(", ");
}
