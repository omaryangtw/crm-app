"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCase } from "@/app/_lib/actions/case-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/app/_components/confirm-dialog";

interface Props {
  caseId: number;
  caseName: string | null;
}

export function DeleteCaseButton({ caseId, caseName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteCase(caseId);
      if (result.success) {
        router.push("/cases");
      } else {
        alert(result.error ?? "刪除失敗");
      }
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)} disabled={isPending}>
        {isPending ? "刪除中..." : "刪除"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="確認刪除"
        description={`確定要刪除案件「${caseName ?? "此案件"}」嗎？此操作無法復原。`}
        confirmLabel="刪除"
        variant="destructive"
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}
