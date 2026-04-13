"use client";

import { useState } from "react";
import Papa from "papaparse";
import { exportClients } from "@/app/_lib/actions/export-actions";
import { EXPORT_PRESETS } from "@/app/_lib/utils/export-utils";
import type { ExportCriteria, ExportQuery } from "@/app/_lib/schemas/export-schema";

const CLIENT_COLUMNS = [
  { key: "name", label: "姓名" },
  { key: "nameAlt", label: "別名" },
  { key: "idn", label: "身分證字號" },
  { key: "sex", label: "性別" },
  { key: "birthday", label: "生日" },
  { key: "isDead", label: "已歿" },
  { key: "householdAdmin", label: "戶長" },
  { key: "incomeStatus", label: "收入狀態" },
  { key: "disabledStatus", label: "身障狀態" },
  { key: "indigenousGroup", label: "族別" },
  { key: "tribe", label: "部落" },
  { key: "plainMountain", label: "平原/山原" },
  { key: "canCall", label: "可電聯" },
  { key: "phone", label: "電話" },
  { key: "mobile", label: "手機" },
  { key: "mobileAlt", label: "手機(備)" },
  { key: "canMail", label: "可郵寄" },
  { key: "city", label: "縣市" },
  { key: "dist", label: "區" },
  { key: "vill", label: "里" },
  { key: "addr", label: "地址" },
  { key: "note", label: "備註" },
] as const;

const GROUP_OPTIONS = [
  { value: "", label: "不限" },
  { value: "any", label: "任一族別" },
  { value: "amis", label: "阿美" },
  { value: "atayal", label: "泰雅" },
  { value: "bunun", label: "布農" },
  { value: "kanakanavu", label: "卡那卡那富" },
  { value: "kavalan", label: "噶瑪蘭" },
  { value: "paiwan", label: "排灣" },
  { value: "puyuma", label: "卑南" },
  { value: "rukai", label: "魯凱" },
  { value: "hla_alua", label: "拉阿魯哇" },
  { value: "saisiyat", label: "賽夏" },
  { value: "sakizaya", label: "撒奇萊雅" },
  { value: "seediq", label: "賽德克" },
  { value: "truku", label: "太魯閣" },
  { value: "thao", label: "邵" },
  { value: "tsou", label: "鄒" },
  { value: "yami", label: "雅美" },
];

export default function ExportPage() {
  const [query, setQuery] = useState<ExportQuery>({});
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleColumn(key: string) {
    setSelectedColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function selectAllColumns() {
    const all: Record<string, boolean> = {};
    for (const col of CLIENT_COLUMNS) all[col.key] = true;
    setSelectedColumns(all);
  }

  function clearAllColumns() {
    setSelectedColumns({});
  }

  function downloadCsv(data: Record<string, unknown>[], filename: string) {
    const cols = Object.keys(data[0] ?? {});
    const csv = Papa.unparse(data, { columns: cols });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExport(criteria: ExportCriteria, filename: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await exportClients(criteria);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data.length === 0) {
        setError("查無符合條件的資料");
        return;
      }
      downloadCsv(result.data, filename);
    } catch {
      setError("匯出失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  async function handleCustomExport() {
    const attrs: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(selectedColumns)) {
      if (v) attrs[k] = true;
    }
    if (Object.keys(attrs).length === 0) {
      setError("請至少選擇一個欄位");
      return;
    }
    await handleExport({ query, attributes: attrs }, "export.csv");
  }

  async function handlePreset(preset: "householdMailing" | "smsList" | "googleContacts") {
    const config = EXPORT_PRESETS[preset];
    if ("flag" in config) {
      await handleExport({ query: {}, attributes: {}, flag: config.flag }, "google-contacts.csv");
    } else {
      const attrs: Record<string, boolean> = {};
      for (const col of config.columns) attrs[col] = true;
      await handleExport(
        { query: config.filters, attributes: attrs, groupBy: config.groupBy },
        `${preset}.csv`
      );
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-4">資料匯出</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Preset buttons */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">快速匯出</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handlePreset("householdMailing")}
            disabled={loading}
            className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            平原家戶寄件
          </button>
          <button
            onClick={() => handlePreset("smsList")}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            簡訊清單
          </button>
          <button
            onClick={() => handlePreset("googleContacts")}
            disabled={loading}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
          >
            匯入Google通訊錄
          </button>
        </div>
      </div>

      {/* Custom export filters */}
      <div className="mb-6 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">篩選條件</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Boolean filters */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={query.isDead === false}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  isDead: e.target.checked ? false : undefined,
                }))
              }
            />
            排除已歿
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={query.canCall === true}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  canCall: e.target.checked ? true : undefined,
                }))
              }
            />
            可電聯
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={query.canMail === true}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  canMail: e.target.checked ? true : undefined,
                }))
              }
            />
            可郵寄
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={query.householdAdmin === true}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  householdAdmin: e.target.checked ? true : undefined,
                }))
              }
            />
            僅戶長
          </label>

          {/* Sex */}
          <label className="text-sm text-gray-600">
            性別
            <select
              value={query.sex ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  sex: (e.target.value || undefined) as ExportQuery["sex"],
                }))
              }
              className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">不限</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </label>

          {/* Disabled status */}
          <label className="text-sm text-gray-600">
            身障狀態
            <select
              value={query.disabledStatus ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  disabledStatus: (e.target.value || undefined) as ExportQuery["disabledStatus"],
                }))
              }
              className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">不限</option>
              <option value="any">任一</option>
              <option value="light">輕度</option>
              <option value="mid">中度</option>
              <option value="heavy">重度</option>
            </select>
          </label>

          {/* Income status */}
          <label className="text-sm text-gray-600">
            收入狀態
            <select
              value={query.incomeStatus ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  incomeStatus: (e.target.value || undefined) as ExportQuery["incomeStatus"],
                }))
              }
              className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">不限</option>
              <option value="any">任一</option>
              <option value="low">低收</option>
              <option value="mid_low">中低收</option>
              <option value="mid_low_elderly">中低收老人</option>
            </select>
          </label>

          {/* Indigenous group */}
          <label className="text-sm text-gray-600">
            族別
            <select
              value={query.group ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  group: (e.target.value || undefined) as ExportQuery["group"],
                }))
              }
              className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              {GROUP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Plain/Mountain */}
          <label className="text-sm text-gray-600">
            平原/山原
            <select
              value={query.plainMountain ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  plainMountain: (e.target.value || undefined) as ExportQuery["plainMountain"],
                }))
              }
              className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">不限</option>
              <option value="any">任一</option>
              <option value="plain">平原</option>
              <option value="mountain">山原</option>
            </select>
          </label>

          {/* Age range */}
          <label className="text-sm text-gray-600">
            年齡
            <input
              type="number"
              placeholder="最小"
              value={query.ageMin ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  ageMin: e.target.value ? parseInt(e.target.value) : undefined,
                }))
              }
              className="ml-2 w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
            <span className="mx-1">~</span>
            <input
              type="number"
              placeholder="最大"
              value={query.ageMax ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  ageMax: e.target.value ? parseInt(e.target.value) : undefined,
                }))
              }
              className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </label>

          {/* Partial match text fields */}
          <label className="text-sm text-gray-600">
            縣市
            <input
              type="text"
              value={query.city ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, city: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-gray-600">
            區
            <input
              type="text"
              value={query.dist ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, dist: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-gray-600">
            姓名
            <input
              type="text"
              value={query.name ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, name: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-gray-600">
            里
            <input
              type="text"
              value={query.vill ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, vill: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-gray-600">
            部落
            <input
              type="text"
              value={query.tribe ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, tribe: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-gray-600">
            備註
            <input
              type="text"
              value={query.note ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, note: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
        </div>
      </div>

      {/* Column selection */}
      <div className="mb-6 rounded-md border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-700">選擇欄位</h2>
          <div className="flex gap-2">
            <button
              onClick={selectAllColumns}
              className="text-xs text-blue-600 hover:underline"
            >
              全選
            </button>
            <button
              onClick={clearAllColumns}
              className="text-xs text-gray-500 hover:underline"
            >
              清除
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {CLIENT_COLUMNS.map((col) => (
            <label key={col.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!selectedColumns[col.key]}
                onChange={() => toggleColumn(col.key)}
              />
              {col.label}
            </label>
          ))}
        </div>
      </div>

      {/* Custom export button */}
      <button
        onClick={handleCustomExport}
        disabled={loading}
        className="rounded-md bg-indigo-600 px-6 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "匯出中..." : "自訂匯出"}
      </button>
    </div>
  );
}
