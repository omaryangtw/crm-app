"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Papa from "papaparse";
import { X } from "lucide-react";
import { exportClients } from "@/app/_lib/actions/export-actions";
import { getExportAuditLogs } from "@/app/_lib/actions/export-audit-actions";
import type { ExportAuditEntry } from "@/app/_lib/actions/export-audit-actions";
import { EXPORT_PRESETS } from "@/app/_lib/utils/export-utils";
import type { ExportCriteria, ExportQuery } from "@/app/_lib/schemas/export-schema";
import { Button } from "@/components/ui/button";
import { FormGrid } from "@/app/_components/form-grid";
import { useExportPresets } from "@/app/_hooks/use-export-presets";
import { safeGetItem, safeSetItem } from "@/app/_lib/utils/storage";

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

// Read last-used state from localStorage (runs once at module init for SSR safety)
function readLastUsed(): { query: ExportQuery; columns: Record<string, boolean> } {
  const saved = safeGetItem<{ query: ExportQuery; columns: Record<string, boolean> }>("export-last-used");
  if (saved && typeof saved === "object" && "query" in saved && "columns" in saved) {
    return { query: saved.query ?? {}, columns: saved.columns ?? {} };
  }
  return { query: {}, columns: {} };
}

export default function ExportPage() {
  // Start with empty state to match SSR — read localStorage after mount
  const [query, setQuery] = useState<ExportQuery>({});
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<ExportAuditEntry[]>([]);

  // Load audit logs on mount and after each export
  const loadAuditLogs = useCallback(async () => {
    const logs = await getExportAuditLogs();
    setAuditLogs(logs);
  }, []);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  // Restore last-used state from localStorage after client mount
  useEffect(() => {
    const saved = readLastUsed();
    if (Object.keys(saved.query).length > 0) setQuery(saved.query);
    if (Object.keys(saved.columns).length > 0) setSelectedColumns(saved.columns);
  }, []);

  // Task 6.1: Integrate useExportPresets hook
  const { presets, savePreset, deletePreset, loadPreset } = useExportPresets();

  // Task 6.3: Debounced persist of last-used state (1000ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistLastUsed = useCallback((q: ExportQuery, cols: Record<string, boolean>) => {
    safeSetItem("export-last-used", { query: q, columns: cols });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistLastUsed(query, selectedColumns);
    }, 1000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedColumns, persistLastUsed]);

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
      // Refresh audit logs after successful export
      void loadAuditLogs();
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

  // Task 6.1: Load a custom preset into query + columns state
  function handleLoadCustomPreset(name: string) {
    const result = loadPreset(name);
    if (!result) return;
    setQuery(result.query);
    setSelectedColumns(result.columns);
    // Task 6.3: Sync last-used state immediately when loading a preset
    persistLastUsed(result.query, result.columns);
  }

  // Task 6.2: Save current state as a custom preset
  function handleSaveAsPreset() {
    const name = prompt("請輸入預設名稱");
    if (name === null) return; // user cancelled
    if (name.trim() === "") {
      alert("請輸入預設名稱");
      return;
    }
    if (presets.some((p) => p.name === name)) {
      if (!confirm("已存在同名預設，是否覆蓋？")) return;
    }
    savePreset(name, query, selectedColumns);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-4">資料匯出</h1>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Preset buttons */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-foreground mb-2">快速匯出</h2>
        <div className="flex flex-wrap gap-2">
          {/* Built-in presets — no delete icon */}
          <Button
            onClick={() => handlePreset("householdMailing")}
            disabled={loading}
            variant="secondary"
          >
            平原家戶寄件
          </Button>
          <Button
            onClick={() => handlePreset("smsList")}
            disabled={loading}
          >
            簡訊清單
          </Button>
          <Button
            onClick={() => handlePreset("googleContacts")}
            disabled={loading}
            variant="outline"
          >
            匯入Google通訊錄
          </Button>

          {/* Task 6.1: Custom preset buttons with delete icon */}
          {presets.map((preset) => (
            <span key={preset.name} className="inline-flex items-center gap-1">
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => handleLoadCustomPreset(preset.name)}
              >
                {preset.name}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => deletePreset(preset.name)}
                aria-label={`刪除預設 ${preset.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </span>
          ))}
        </div>

        {/* Task 6.2: Save as preset button */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={handleSaveAsPreset}
        >
          儲存為預設
        </Button>
      </div>

      {/* Custom export filters */}
      <div className="mb-6 rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-foreground mb-3">篩選條件</h2>
        <FormGrid>
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
          <label className="text-sm text-muted-foreground">
            性別
            <select
              value={query.sex ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  sex: (e.target.value || undefined) as ExportQuery["sex"],
                }))
              }
              className="ml-2 rounded-md border border-input px-2 py-1 text-sm"
            >
              <option value="">不限</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </label>

          {/* Disabled status */}
          <label className="text-sm text-muted-foreground">
            身障狀態
            <select
              value={query.disabledStatus ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  disabledStatus: (e.target.value || undefined) as ExportQuery["disabledStatus"],
                }))
              }
              className="ml-2 rounded-md border border-input px-2 py-1 text-sm"
            >
              <option value="">不限</option>
              <option value="any">任一</option>
              <option value="light">輕度</option>
              <option value="mid">中度</option>
              <option value="heavy">重度</option>
            </select>
          </label>

          {/* Income status */}
          <label className="text-sm text-muted-foreground">
            收入狀態
            <select
              value={query.incomeStatus ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  incomeStatus: (e.target.value || undefined) as ExportQuery["incomeStatus"],
                }))
              }
              className="ml-2 rounded-md border border-input px-2 py-1 text-sm"
            >
              <option value="">不限</option>
              <option value="any">任一</option>
              <option value="low">低收</option>
              <option value="mid_low">中低收</option>
              <option value="mid_low_elderly">中低收老人</option>
            </select>
          </label>

          {/* Indigenous group */}
          <label className="text-sm text-muted-foreground">
            族別
            <select
              value={query.group ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  group: (e.target.value || undefined) as ExportQuery["group"],
                }))
              }
              className="ml-2 rounded-md border border-input px-2 py-1 text-sm"
            >
              {GROUP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Plain/Mountain */}
          <label className="text-sm text-muted-foreground">
            平原/山原
            <select
              value={query.plainMountain ?? ""}
              onChange={(e) =>
                setQuery((q) => ({
                  ...q,
                  plainMountain: (e.target.value || undefined) as ExportQuery["plainMountain"],
                }))
              }
              className="ml-2 rounded-md border border-input px-2 py-1 text-sm"
            >
              <option value="">不限</option>
              <option value="any">任一</option>
              <option value="plain">平原</option>
              <option value="mountain">山原</option>
            </select>
          </label>

          {/* Age range */}
          <label className="text-sm text-muted-foreground">
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
              className="ml-2 w-16 rounded-md border border-input px-2 py-1 text-sm"
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
              className="w-16 rounded-md border border-input px-2 py-1 text-sm"
            />
          </label>

          {/* Partial match text fields */}
          <label className="text-sm text-muted-foreground">
            縣市
            <input
              type="text"
              value={query.city ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, city: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-input px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            區
            <input
              type="text"
              value={query.dist ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, dist: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-input px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            姓名
            <input
              type="text"
              value={query.name ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, name: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-input px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            里
            <input
              type="text"
              value={query.vill ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, vill: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-input px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            部落
            <input
              type="text"
              value={query.tribe ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, tribe: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-input px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            備註
            <input
              type="text"
              value={query.note ?? ""}
              onChange={(e) =>
                setQuery((q) => ({ ...q, note: e.target.value || undefined }))
              }
              className="ml-2 w-28 rounded-md border border-input px-2 py-1 text-sm"
            />
          </label>
        </FormGrid>
      </div>

      {/* Column selection */}
      <div className="mb-6 rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-foreground">選擇欄位</h2>
          <div className="flex gap-2">
            <button
              onClick={selectAllColumns}
              className="text-xs text-primary hover:underline"
            >
              全選
            </button>
            <button
              onClick={clearAllColumns}
              className="text-xs text-muted-foreground hover:underline"
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
      <Button
        onClick={handleCustomExport}
        disabled={loading}
      >
        {loading ? "匯出中..." : "自訂匯出"}
      </Button>

      {/* Export audit history */}
      {auditLogs.length > 0 && (
        <div className="mt-8 rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground mb-3">匯出紀錄</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">時間</th>
                  <th className="pb-2 pr-4 font-medium">操作者</th>
                  <th className="pb-2 pr-4 font-medium">類型</th>
                  <th className="pb-2 pr-4 font-medium">筆數</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("zh-TW")}
                    </td>
                    <td className="py-2 pr-4">{log.userEmail}</td>
                    <td className="py-2 pr-4">
                      {log.exportType === "custom" ? "自訂匯出" : log.exportType === "googleContacts" ? "Google 通訊錄" : log.exportType}
                    </td>
                    <td className="py-2 pr-4">{log.resultCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
