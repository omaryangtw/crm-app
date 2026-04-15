"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ClientSelector from "@/app/_components/client-selector";
import StaffSelector from "@/app/_components/staff-selector";
import { FormGrid } from "@/app/_components/form-grid";
import { createTodo, updateTodo } from "@/app/_lib/actions/todo-actions";

interface TodoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, we're editing; otherwise creating */
  editingTodo?: {
    id: number;
    date: string | null;
    createdAt: string;
    note: string | null;
    client: { id: number; name: string | null } | null;
    staffInCharge: { id: number; name: string }[];
  } | null;
}

const labelClass = "mb-1 block text-sm font-medium";

export function TodoFormDialog({ open, onOpenChange, editingTodo }: TodoFormDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!editingTodo;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      let result;
      if (isEdit && editingTodo) {
        result = await updateTodo(editingTodo.id, formData);
      } else {
        result = await createTodo(formData);
      }

      if (result.success) {
        toast.success(isEdit ? "待辦已更新" : "待辦已新增");
        onOpenChange(false);
        formRef.current?.reset();
      } else {
        setError(result.error ?? "操作失敗");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯待辦" : "新增待辦"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "修改待辦事項內容" : "為族人建立新的待辦事項"}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" key={editingTodo?.id ?? "new"}>
          {!isEdit && (
            <ClientSelector
              name="clientId"
              label="關聯族人（選填）"
            />
          )}
          {isEdit && editingTodo?.client && (
            <div>
              <span className="mb-1 block text-sm font-medium">關聯族人</span>
              <p className="text-sm py-2">{editingTodo.client.name ?? "未命名"}</p>
            </div>
          )}

          <FormGrid columns="2">
            <div>
              <label htmlFor="todo-date" className={labelClass}>期限</label>
              <Input
                id="todo-date"
                type="date"
                name="date"
                defaultValue={editingTodo?.date ?? new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <StaffSelector
                name="staffInChargeIds"
                defaultValue={editingTodo?.staffInCharge.map((s) => s.id) ?? []}
              />
            </div>
          </FormGrid>

          <div>
            <label htmlFor="todo-note" className={labelClass}>備註</label>
            <Textarea
              id="todo-note"
              name="note"
              rows={3}
              defaultValue={editingTodo?.note ?? ""}
              placeholder="待辦事項說明..."
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "處理中..." : isEdit ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
