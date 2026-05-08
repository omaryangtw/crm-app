"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { autoBindByEmail } from "@/app/_lib/actions/binding-actions";
import type { AutoBindResult } from "@/app/_lib/actions/binding-actions";

interface AutoBindBannerProps {
  candidateCount: number;
}

export default function AutoBindBanner({
  candidateCount,
}: AutoBindBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AutoBindResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (candidateCount <= 0 && !result) return null;

  const handleAutoBind = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await autoBindByEmail();
        if (res.success) {
          setResult(res);
          router.refresh();
        } else {
          setError(res.error ?? "自動連結失敗");
        }
      } catch {
        setError("系統錯誤，請稍後再試");
      }
    });
  };

  return (
    <div className="rounded-md border border-border bg-muted px-4 py-3">
      {result ? (
        <p className="text-sm text-muted-foreground">
          自動連結完成：成功 {result.bound} 筆、跳過 {result.skipped} 筆
        </p>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            偵測到 {candidateCount} 筆 email 相符的 Staff-User
            配對可自動連結
          </p>
          <Button
            size="sm"
            disabled={isPending}
            onClick={handleAutoBind}
          >
            {isPending ? "處理中…" : "自動連結"}
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
