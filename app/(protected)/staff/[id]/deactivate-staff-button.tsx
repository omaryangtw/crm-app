"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateStaff } from "@/app/_lib/actions/staff-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/app/_components/confirm-dialog";

interface Props {
  staffId: number;
  staffName: string;
}

export function DeactivateStaffButton({ staffId, staffName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await deactivateStaff(staffId);
      if (result.success) {
        setDialogOpen(false);
        router.refresh();
      } else {
        setDialogOpen(false);
        alert(result.error ?? "停用失敗");
      }
    });
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setDialogOpen(true)}
        disabled={isPending}
      >
        {isPending ? "停用中..." : "停用"}
      </Button>
      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="確認停用"
        description={`確定要停用員工「${staffName}」嗎？停用後將無法被指派為新案件的承辦人。`}
        confirmLabel="停用"
        variant="destructive"
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}
