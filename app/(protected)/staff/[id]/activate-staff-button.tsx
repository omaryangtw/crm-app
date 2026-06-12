"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateStaff } from "@/app/_lib/actions/staff-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/app/_components/confirm-dialog";

interface Props {
  staffId: number;
  staffName: string;
}

export function ActivateStaffButton({ staffId, staffName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await activateStaff(staffId);
      if (result.success) {
        setDialogOpen(false);
        router.refresh();
      } else {
        setDialogOpen(false);
        alert(result.error ?? "啟用失敗");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setDialogOpen(true)} disabled={isPending}>
        {isPending ? "啟用中..." : "啟用"}
      </Button>
      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="確認啟用"
        description={`確定要重新啟用員工「${staffName}」嗎？啟用後可被指派為新案件的承辦人。`}
        confirmLabel="啟用"
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}
