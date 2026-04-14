"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DraftPromptProps {
  /** Draft saved time (ISO format) */
  savedAt: string;
  /** Callback when user clicks "Restore" */
  onRestore: () => void;
  /** Callback when user clicks "Discard" */
  onDiscard: () => void;
}

export function DraftPrompt({ savedAt, onRestore, onDiscard }: DraftPromptProps) {
  const formattedTime = new Date(savedAt).toLocaleString("zh-TW");

  return (
    <Card className="border-primary">
      <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium">偵測到未完成的草稿，是否還原？</p>
          <p className="text-sm text-muted-foreground">儲存時間：{formattedTime}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" onClick={onRestore}>
            還原
          </Button>
          <Button variant="outline" onClick={onDiscard}>
            捨棄
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
