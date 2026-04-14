"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getCascadeImpactAction } from "@/app/_lib/actions/deletion-actions";
import type { EntityType } from "@/app/_lib/audit/audit-types";
import type { CascadeEntityType } from "@/app/_lib/utils/snapshot-builder";
import type { CascadeImpact } from "@/app/_lib/utils/cascade-impact";

interface DeleteRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  entityId: number;
  entityLabel: string;
  onConfirm: (cascadeSelection: CascadeEntityType[]) => void;
  loading?: boolean;
}

interface CascadeOption {
  key: CascadeEntityType;
  label: string;
  countKey: keyof CascadeImpact;
}

const CASCADE_OPTIONS: CascadeOption[] = [
  { key: "Case", label: "案件", countKey: "cases" },
  { key: "Contact", label: "通聯紀錄", countKey: "contacts" },
  { key: "Todo", label: "待辦事項", countKey: "todos" },
  { key: "FamilyRelation", label: "家庭關係", countKey: "familyRelations" },
  { key: "ClientPhoto", label: "照片", countKey: "photos" },
];

export function DeleteRequestDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityLabel,
  onConfirm,
  loading = false,
}: DeleteRequestDialogProps) {
  const [impact, setImpact] = useState<CascadeImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [selected, setSelected] = useState<Set<CascadeEntityType>>(
    new Set(CASCADE_OPTIONS.map((o) => o.key))
  );

  // Fetch cascade impact on mount for Client entities
  useEffect(() => {
    if (!open) return;
    if (entityType !== "Client") return;

    setLoadingImpact(true);
    getCascadeImpactAction(entityType, entityId)
      .then((result) => {
        if (result.success) {
          setImpact(result.data);
        }
      })
      .finally(() => setLoadingImpact(false));
  }, [open, entityType, entityId]);

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelected(new Set(CASCADE_OPTIONS.map((o) => o.key)));
      setImpact(null);
    }
  }, [open]);

  function handleToggle(key: CascadeEntityType, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(Array.from(selected));
  }

  // Simple confirmation for Case/Contact
  if (entityType !== "Client") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>確認刪除申請</DialogTitle>
            <DialogDescription>
              確認要申請刪除此資料？
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            將為「{entityLabel}」建立刪除申請，需經管理員審核後才會刪除。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={handleConfirm}
            >
              {loading ? "處理中..." : "申請刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Client: cascade impact preview with checkboxes
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>確認刪除申請</DialogTitle>
          <DialogDescription>
            將為「{entityLabel}」建立刪除申請，需經管理員審核後才會刪除。
          </DialogDescription>
        </DialogHeader>

        {loadingImpact ? (
          <p className="text-sm text-muted-foreground">載入關聯資料中...</p>
        ) : impact ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">以下關聯資料將一併刪除：</p>
            {CASCADE_OPTIONS.map((option) => {
              const count = impact[option.countKey];
              return (
                <label
                  key={option.key}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selected.has(option.key)}
                    onCheckedChange={(checked) =>
                      handleToggle(option.key, !!checked)
                    }
                    disabled={loading}
                  />
                  <span>
                    {option.label}（{count} 筆）
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={loading || loadingImpact}
            onClick={handleConfirm}
          >
            {loading ? "處理中..." : "申請刪除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
