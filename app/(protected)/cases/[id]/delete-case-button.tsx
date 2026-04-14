"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCase } from "@/app/_lib/actions/case-actions";
import { Button } from "@/components/ui/button";
import { DeleteRequestDialog } from "@/app/_components/delete-request-dialog";

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
      <DeleteRequestDialog
        open={open}
        onOpenChange={setOpen}
        entityType="Case"
        entityId={caseId}
        entityLabel={caseName ?? "此案件"}
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}
