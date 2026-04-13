"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createFamilyRelation, deleteFamilyRelation } from "@/app/_lib/actions/family-actions";
import { VALID_RELATIONSHIPS } from "@/app/_lib/constants/relationship-map";

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

export function FamilySection({ clientId, familyMembers }: FamilySectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [relationship, setRelationship] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setError("");
    const tid = Number(targetId);
    if (!tid || !relationship) {
      setError("請填寫目標族人 ID 與關係");
      return;
    }

    startTransition(async () => {
      const result = await createFamilyRelation(clientId, tid, relationship);
      if (!result.success) {
        setError(result.error);
      } else {
        setTargetId("");
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
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">家庭關係 ({familyMembers.length})</h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {showForm ? "取消" : "新增關係"}
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-2">{error}</p>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="targetId" className="block text-sm font-medium text-gray-700">
                目標族人 ID
              </label>
              <input
                id="targetId"
                type="number"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="輸入族人 ID"
              />
            </div>
            <div>
              <label htmlFor="relationship" className="block text-sm font-medium text-gray-700">
                關係類型
              </label>
              <select
                id="relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">請選擇關係</option>
                {VALID_RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAdd}
                disabled={isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? "處理中..." : "確認新增"}
              </button>
            </div>
          </div>
        </div>
      )}

      {familyMembers.length === 0 ? (
        <p className="text-gray-500 text-sm">尚無家庭關係</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">姓名</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">關係</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {familyMembers.map((fm) => (
                <tr key={`${fm.id}-${fm.personId}`}>
                  <td className="px-4 py-2">{fm.personName}</td>
                  <td className="px-4 py-2">{fm.relationship}</td>
                  <td className="px-4 py-2 flex gap-2">
                    <Link
                      href={`/clients/${fm.personId}`}
                      className="text-indigo-600 hover:underline"
                    >
                      查看
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(fm.id)}
                      disabled={isPending}
                      className="text-red-600 hover:underline disabled:opacity-50"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
