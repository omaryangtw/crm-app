"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deactivateStaff } from "@/app/_lib/actions/staff-actions";

interface Props {
  staffId: number;
  staffName: string;
}

export function DeactivateStaffButton({ staffId, staffName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDeactivate() {
    const confirmed = window.confirm(
      `確定要停用員工「${staffName}」嗎？停用後將無法被指派為新案件的承辦人。`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deactivateStaff(staffId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error ?? "停用失敗");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleDeactivate}
      disabled={isPending}
      className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
    >
      {isPending ? "停用中..." : "停用"}
    </button>
  );
}
