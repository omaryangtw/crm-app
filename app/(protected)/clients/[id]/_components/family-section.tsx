"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createFamilyRelation, deleteFamilyRelation } from "@/app/_lib/actions/family-actions";
import { VALID_RELATIONSHIPS } from "@/app/_lib/constants/relationship-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ClientSelector from "@/app/_components/client-selector";

interface FamilyMember {
  id: number;
  personId: number;
  personName: string;
  relationship: string;
}

interface FamilySectionProps {
  clientId: number;
  familyMembers: FamilyMember[];
}

const selectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function FamilySection({ clientId, familyMembers }: FamilySectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [relationship, setRelationship] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setError("");
    // Read targetId from the ClientSelector hidden input
    const hiddenInput = document.querySelector<HTMLInputElement>('input[name="targetId"]');
    const tid = Number(hiddenInput?.value);
    if (!tid || !relationship) {
      setError("請選擇目標族人與關係");
      return;
    }

    startTransition(async () => {
      const result = await createFamilyRelation(clientId, tid, relationship);
      if (!result.success) {
        setError(result.error);
      } else {
        setRelationship("");
        setShowForm(false);
      }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteFamilyRelation(id);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>家庭關係 ({familyMembers.length})</CardTitle>
        <Button
          type="button"
          size="sm"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "取消" : "新增關係"}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive mb-2">{error}</p>
        )}

        {showForm && (
          <div className="rounded-lg border bg-muted/50 p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ClientSelector
                name="targetId"
                label="目標族人"
              />
              <div>
                <label htmlFor="relationship" className="block text-sm font-medium mb-1">
                  關係類型
                </label>
                <select
                  id="relationship"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className={selectClass}
                >
                  <option value="">請選擇關係</option>
                  {VALID_RELATIONSHIPS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={handleAdd}
                  disabled={isPending}
                >
                  {isPending ? "處理中..." : "確認新增"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {familyMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚無家庭關係</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>關係</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {familyMembers.map((fm) => (
                <TableRow key={`${fm.id}-${fm.personId}`}>
                  <TableCell>{fm.personName}</TableCell>
                  <TableCell>{fm.relationship}</TableCell>
                  <TableCell className="flex gap-2">
                    <Link
                      href={`/clients/${fm.personId}`}
                      className="text-primary hover:underline"
                    >
                      查看
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(fm.id)}
                      disabled={isPending}
                      className="text-destructive hover:underline disabled:opacity-50"
                    >
                      刪除
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
