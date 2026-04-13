"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteClient } from "@/app/_lib/actions/client-actions";

interface Props {
  clientId: number;
  clientName: string | null;
}

export function DeleteClientButton({ clientId, clientName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      `確定要刪除「${clientName ?? "此族人"}」嗎？此操作將同時刪除所有相關案件與通聯紀錄，且無法復原。`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteClient(clientId);
      if (result.success) {
        router.push("/clients");
      } else {
        alert(result.error ?? "刪除失敗");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
    >
      {isPending ? "刪除中..." : "刪除"}
    </button>
  );
}
