"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClient } from "@/app/_lib/actions/client-actions";
import { Button } from "@/components/ui/button";
import { DeleteRequestDialog } from "@/app/_components/delete-request-dialog";
import type { CascadeEntityType } from "@/app/_lib/utils/snapshot-builder";

interface Props {
  clientId: number;
  clientName: string | null;
}

export function DeleteClientButton({ clientId, clientName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm(cascadeSelection: CascadeEntityType[]) {
    startTransition(async () => {
      const result = await deleteClient(clientId, cascadeSelection);
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
      <DeleteRequestDialog
        open={open}
        onOpenChange={setOpen}
        entityType="Client"
        entityId={clientId}
        entityLabel={clientName ?? "此族人"}
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}
