"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteCase } from "@/app/_lib/actions/case-actions";

interface Props {
  caseId: number;
  caseName: string | null;
}

export function DeleteCaseButton({ caseId, caseName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      `確定要刪除案件「${caseName ?? "此案件"}」嗎？此操作無法復原。`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteCase(caseId);
      if (result.success) {
        router.push("/cases");
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
