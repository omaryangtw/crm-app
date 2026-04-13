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
