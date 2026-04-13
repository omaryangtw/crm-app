"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { completeTodo, deleteTodo } from "@/app/_lib/actions/todo-actions";

interface TodoItem {
  id: number;
  date: string | null;
  note: string | null;
  client: {
    id: number;
    name: string | null;
  };
}

interface TodoDashboardProps {
  todos: TodoItem[];
}

export function TodoDashboard({ todos }: TodoDashboardProps) {
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleComplete(todoId: number) {
    startTransition(async () => {
      await completeTodo(todoId);
      if (selectedTodo?.id === todoId) {
        setSelectedTodo(null);
      }
    });
  }

  function handleDelete(todoId: number) {
    startTransition(async () => {
      await deleteTodo(todoId);
      if (selectedTodo?.id === todoId) {
        setSelectedTodo(null);
      }
    });
  }

  return (
    <div className="flex gap-6">
      {/* Todo list */}
      <div className="flex-1">
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b">
            <h2 className="text-lg font-semibold">待辦事項</h2>
          </div>
          {todos.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              目前沒有待辦事項
            </div>
          ) : (
            <div className="divide-y">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-sm text-gray-500 shrink-0">
                      {todo.date ?? "—"}
                    </span>
                    <Link
                      href={`/clients/${todo.client.id}`}
                      className="text-blue-600 hover:underline truncate"
                    >
                      {todo.client.name ?? "未命名"}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <button
                      type="button"
                      onClick={() => setSelectedTodo(todo)}
                      className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
                    >
                      查看
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleComplete(todo.id)}
                      className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      完成
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(todo.id)}
                      className="px-3 py-1 text-sm rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      刪除
                    </button>
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
          <div className="bg-white rounded-lg shadow sticky top-4">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">待辦詳情</h3>
              <button
                type="button"
                onClick={() => setSelectedTodo(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <span className="text-sm text-gray-500">日期</span>
                <p>{selectedTodo.date ?? "—"}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">族人</span>
                <p>
                  <Link
                    href={`/clients/${selectedTodo.client.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {selectedTodo.client.name ?? "未命名"}
                  </Link>
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">備註</span>
                <p className="whitespace-pre-wrap">
                  {selectedTodo.note || "無"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
