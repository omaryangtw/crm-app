"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { completeTodo, deleteTodo } from "@/app/_lib/actions/todo-actions";
import { filterTodos, formatStaffNames } from "@/app/_lib/utils/todo-utils";
import { Button } from "@/components/ui/button";
import { TodoFormDialog } from "@/app/_components/todo-form-dialog";
import { ConfirmDialog } from "@/app/_components/confirm-dialog";

interface TodoItem {
  id: number;
  date: string | null;
  createdAt: string;
  note: string | null;
  client: {
    id: number;
    name: string | null;
  } | null;
  staffInCharge: { id: number; name: string }[];
}

interface TodoDashboardProps {
  todos: TodoItem[];
  sessionStaffId: number | null;
}

export function TodoDashboard({ todos, sessionStaffId }: TodoDashboardProps) {
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filterMode, setFilterMode] = useState<"mine" | "all">(
    sessionStaffId != null ? "mine" : "all"
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [deletingTodoId, setDeletingTodoId] = useState<number | null>(null);

  const filteredTodos = useMemo(() => {
    return filterTodos(todos, sessionStaffId, filterMode);
  }, [todos, filterMode, sessionStaffId]);

  function handleComplete(todoId: number) {
    startTransition(async () => {
      await completeTodo(todoId);
      if (selectedTodo?.id === todoId) setSelectedTodo(null);
    });
  }

  function handleDelete(todoId: number) {
    startTransition(async () => {
      await deleteTodo(todoId);
      if (selectedTodo?.id === todoId) setSelectedTodo(null);
      setDeletingTodoId(null);
    });
  }

  return (
    <>
      <div className="flex gap-6">
        {/* Todo list */}
        <div className="flex-1">
          <div className="bg-card rounded-lg shadow">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-heading text-base leading-snug font-medium">待辦事項</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowCreateDialog(true)}
                >
                  新增待辦
                </Button>
                <Button
                  variant={filterMode === "mine" ? "default" : "outline"}
                  size="sm"
                  disabled={sessionStaffId == null}
                  onClick={() => setFilterMode("mine")}
                >
                  我的待辦
                </Button>
                <Button
                  variant={filterMode === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterMode("all")}
                >
                  全部待辦
                </Button>
              </div>
            </div>
            {filteredTodos.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                目前沒有待辦事項
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span
                        className={`text-sm shrink-0 rounded px-1.5 py-0.5 ${
                          todo.date && todo.date <= new Date().toISOString().slice(0, 10)
                            ? "bg-destructive/15 text-destructive font-medium"
                            : "text-muted-foreground"
                        }`}
                        title="期限"
                      >
                        {todo.date ? `期限 ${todo.date}` : "無期限"}
                      </span>
                    {todo.client ? (
                      <Link
                        href={`/clients/${todo.client.id}`}
                        className="text-primary hover:underline truncate"
                      >
                        {todo.client.name ?? "未命名"}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground truncate">一般待辦</span>
                    )}
                      <span className="text-sm text-muted-foreground truncate">
                        {formatStaffNames(todo.staffInCharge)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTodo(todo)}
                      >
                        查看
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTodo(todo)}
                      >
                        編輯
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleComplete(todo.id)}
                      >
                        完成
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isPending}
                        onClick={() => setDeletingTodoId(todo.id)}
                      >
                        刪除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedTodo && (
          <div className="w-80 shrink-0">
            <div className="bg-card rounded-lg shadow sticky top-4">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold">待辦詳情</h3>
                <button
                  type="button"
                  onClick={() => setSelectedTodo(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">期限</span>
                  <p>
                    {selectedTodo.date ? (
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          selectedTodo.date <= new Date().toISOString().slice(0, 10)
                            ? "bg-destructive/15 text-destructive font-medium"
                            : ""
                        }`}
                      >
                        {selectedTodo.date}
                      </span>
                    ) : (
                      "無期限"
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">新增日期</span>
                  <p>{selectedTodo.createdAt}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">族人</span>
                  <p>
                    {selectedTodo.client ? (
                      <Link
                        href={`/clients/${selectedTodo.client.id}`}
                        className="text-primary hover:underline"
                      >
                        {selectedTodo.client.name ?? "未命名"}
                      </Link>
                    ) : (
                      "無關聯族人"
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">承辦人</span>
                  <p>{formatStaffNames(selectedTodo.staffInCharge)}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">備註</span>
                  <p className="whitespace-pre-wrap">
                    {selectedTodo.note || "無"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setEditingTodo(selectedTodo);
                    setSelectedTodo(null);
                  }}
                >
                  編輯此待辦
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <TodoFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {/* Edit dialog */}
      <TodoFormDialog
        open={!!editingTodo}
        onOpenChange={(v) => { if (!v) setEditingTodo(null); }}
        editingTodo={editingTodo}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deletingTodoId !== null}
        onOpenChange={(v) => { if (!v) setDeletingTodoId(null); }}
        title="刪除待辦"
        description="確定要刪除此待辦事項嗎？此操作無法復原。"
        variant="destructive"
        confirmLabel="刪除"
        loading={isPending}
        onConfirm={() => {
          if (deletingTodoId !== null) handleDelete(deletingTodoId);
        }}
      />
    </>
  );
}
