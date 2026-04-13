"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClient } from "@/app/_lib/actions/client-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/app/_components/confirm-dialog";

interface Props {
  clientId: number;
  clientName: string | null;
}

export function DeleteClientButton({ clientId, clientName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteClient(clientId);
      if (result.success) {
        router.push("/clients");
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
        description={`確定要刪除「${clientName ?? "此族人"}」嗎？此操作將同時刪除所有相關案件與通聯紀錄，且無法復原。`}
        confirmLabel="刪除"
        variant="destructive"
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}
