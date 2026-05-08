"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Papa from "papaparse";
import { X, ChevronDown, ChevronUp, Upload } from "lucide-react";
import { useSession } from "next-auth/react";
import { exportClients } from "@/app/_lib/actions/export-actions";
import { getExportAuditLogs } from "@/app/_lib/actions/export-audit-actions";
import {
  importClients,
  importCases,
  importContacts,
  importFamilies,
} from "@/app/_lib/actions/import-actions";
import type { ImportResult } from "@/app/_lib/actions/import-actions";
import { getImportAuditLogs } from "@/app/_lib/actions/import-audit-actions";
import type { ImportAuditEntry } from "@/app/_lib/actions/import-audit-actions";
import { runStaffMigration } from "@/app/_lib/actions/staff-migration-action";
import type { StaffMigrationResult } from "@/app/_lib/actions/staff-migration-action";
import type { ExportAuditEntry } from "@/app/_lib/actions/export-audit-actions";
import { EXPORT_PRESETS } from "@/app/_lib/utils/export-utils";
import type { ExportCriteria, ExportQuery } from "@/app/_lib/schemas/export-schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { FormGrid } from "@/app/_components/form-grid";
import { useExportPresets } from "@/app/_hooks/use-export-presets";
import { safeGetItem, safeSetItem } from "@/app/_lib/utils/storage";

// ── Constants ──

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

const IMPORT_TABLES = [
  { value: "clients", label: "族人" },
  { value: "cases", label: "案件" },
  { value: "contacts", label: "通聯" },
  { value: "families", label: "家庭" },
] as const;

type ImportTableValue = (typeof IMPORT_TABLES)[number]["value"];

const TABLE_LABEL_MAP: Record<string, string> = {
  clients: "族人",
  cases: "案件",
  contacts: "通聯",
  families: "家庭",
};

// Read last-used export state from localStorage
function readLastUsed(): { query: ExportQuery; columns: Record<string, boolean> } {
  const saved = safeGetItem<{ query: ExportQuery; columns: Record<string, boolean> }>("export-last-used");
  if (saved && typeof saved === "object" && "query" in saved && "columns" in saved) {
    return { query: saved.query ?? {}, columns: saved.columns ?? {} };
  }
  return { query: {}, columns: {} };
}

// ── Import Result Display Component (Task 7.3) ──

function ImportResultDisplay({ result }: { result: ImportResult }) {
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const totalSuccess = result.inserted + result.overwritten;
  const allSuccess = result.failed === 0 && result.errors.length === 0;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>匯入結果</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {allSuccess && totalSuccess > 0 && (
          <p className="text-sm text-green-700 dark:text-green-400">
            匯入完成，共 {totalSuccess} 筆記錄成功匯入
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
          <div className="rounded-md bg-muted p-2 text-center">
            <div className="text-muted-foreground">新增</div>
            <div className="text-lg font-semibold">{result.inserted}</div>
          </div>
          <div className="rounded-md bg-muted p-2 text-center">
            <div className="text-muted-foreground">覆蓋</div>
            <div className="text-lg font-semibold">{result.overwritten}</div>
          </div>
          <div className="rounded-md bg-muted p-2 text-center">
            <div className="text-muted-foreground">跳過</div>
            <div className="text-lg font-semibold">{result.skipped}</div>
          </div>
          <div className="rounded-md bg-muted p-2 text-center">
            <div className="text-muted-foreground">失敗</div>
            <div className="text-lg font-semibold">{result.failed}</div>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div>
            <button
              onClick={() => setErrorsExpanded(!errorsExpanded)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {errorsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              查看錯誤詳情 ({result.errors.length} 筆)
            </button>
            {errorsExpanded && (
              <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">記錄</th>
                      <th className="px-3 py-2 font-medium">欄位</th>
                      <th className="px-3 py-2 font-medium">錯誤描述</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap">#{err.index}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{err.field}</td>
                        <td className="px-3 py-2">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Import Audit Log Display Component (Task 7.4) ──

function ImportAuditDisplay({ logs }: { logs: ImportAuditEntry[] }) {
  if (logs.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>最近匯入紀錄</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">匯入時間</th>
                <th className="pb-2 pr-4 font-medium">操作者</th>
                <th className="pb-2 pr-4 font-medium">資料表</th>
                <th className="pb-2 pr-4 font-medium">成功筆數</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("zh-TW")}
                  </td>
                  <td className="py-2 pr-4">{log.userEmail}</td>
                  <td className="py-2 pr-4">{TABLE_LABEL_MAP[log.table] ?? log.table}</td>
                  <td className="py-2 pr-4">{log.inserted + log.overwritten}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Import Section Component (Task 7.2) ──

function ImportSection() {
  const [selectedTable, setSelectedTable] = useState<ImportTableValue>("clients");
  const [file, setFile] = useState<File | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<"skip" | "overwrite">("skip");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<ImportAuditEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load import audit logs on mount and after each import
  const loadAuditLogs = useCallback(async () => {
    const logs = await getImportAuditLogs();
    setAuditLogs(logs);
  }, []);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }

    // Frontend validation: extension
    if (!selected.name.toLowerCase().endsWith(".json")) {
      setImportError("請選擇 JSON 檔案");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Frontend validation: size (10MB)
    if (selected.size > 10 * 1024 * 1024) {
      setImportError("檔案大小不可超過 10MB");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFile(selected);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conflictStrategy", conflictStrategy);

      // Call the appropriate server action based on selected table
      let result: ImportResult;
      switch (selectedTable) {
        case "clients":
          result = await importClients(formData);
          break;
        case "cases":
          result = await importCases(formData);
          break;
        case "contacts":
          result = await importContacts(formData);
          break;
        case "families":
          result = await importFamilies(formData);
          break;
      }

      if (!result.success && result.error) {
        setImportError(result.error);
      } else {
        setImportResult(result);
        // Refresh audit logs after successful import
        void loadAuditLogs();
      }
    } catch {
      setImportError("匯入失敗，請稍後再試");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {importError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {importError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>匯入設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Table selector */}
          <div>
            <label className="mb-1 block text-sm font-medium">資料表</label>
            <div className="flex flex-wrap gap-4">
              {IMPORT_TABLES.map((t) => (
                <label key={t.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="importTable"
                    value={t.value}
                    checked={selectedTable === t.value}
                    onChange={() => setSelectedTable(t.value)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="mb-1 block text-sm font-medium">選擇檔案</label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
            />
            <p className="mt-1 text-xs text-muted-foreground">僅接受 .json 檔案，大小上限 10MB</p>
          </div>

          {/* Conflict strategy */}
          <div>
            <label className="mb-1 block text-sm font-medium">衝突處理</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="conflictStrategy"
                  value="skip"
                  checked={conflictStrategy === "skip"}
                  onChange={() => setConflictStrategy("skip")}
                />
                跳過已存在
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="conflictStrategy"
                  value="overwrite"
                  checked={conflictStrategy === "overwrite"}
                  onChange={() => setConflictStrategy("overwrite")}
                />
                覆蓋已存在
              </label>
            </div>
          </div>

          {/* Import button */}
          <Button
            onClick={handleImport}
            disabled={!file || importing}
          >
            {importing ? (
              <>
                <Upload className="h-4 w-4 animate-spin" />
                匯入中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                開始匯入
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Import result display (Task 7.3) */}
      {importResult && <ImportResultDisplay result={importResult} />}

      {/* Staff migration */}
      <StaffMigrationSection />

      {/* Import audit log display (Task 7.4) */}
      <ImportAuditDisplay logs={auditLogs} />
    </div>
  );
}

// ── Staff Migration Section ──

function StaffMigrationSection() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<StaffMigrationResult | null>(null);

  async function handleRun() {
    setRunning(true);
    setResult(null);
    try {
      const r = await runStaffMigration();
      setResult(r);
    } catch {
      setResult({ success: false, staffCreated: 0, caseLinks: 0, contactLinks: 0, unresolved: [], error: "執行失敗" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>員工連結</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          從案件與通聯的承辦人欄位自動建立員工資料並連結。此操作會重建所有員工記錄。
        </p>
        <Button onClick={handleRun} disabled={running} variant="outline">
          {running ? "執行中..." : "執行員工連結"}
        </Button>
        {result && result.success && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <p>建立 {result.staffCreated} 位員工</p>
            <p>案件連結 {result.caseLinks} 筆、通聯連結 {result.contactLinks} 筆</p>
            {result.unresolved.length > 0 && (
              <p className="text-muted-foreground">
                無法解析：{result.unresolved.join("、")}
              </p>
            )}
          </div>
        )}
        {result && !result.success && (
          <p className="text-sm text-destructive">{result.error}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Export Section (preserves all existing export functionality) ──

function ExportSection() {
  const [query, setQuery] = useState<ExportQuery>({});
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<ExportAuditEntry[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null);

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

  const { presets, savePreset, deletePreset, loadPreset } = useExportPresets();

  // Debounced persist of last-used state (1000ms)
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

  async function handlePreview() {
    const attrs: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(selectedColumns)) {
      if (v) attrs[k] = true;
    }
    if (Object.keys(attrs).length === 0) {
      setError("請至少選擇一個欄位");
      return;
    }
    setLoading(true);
    setError(null);
    setPreviewData(null);
    try {
      const result = await exportClients({ query, attributes: attrs }, { preview: true });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data.length === 0) {
        setError("查無符合條件的資料");
        return;
      }
      setPreviewData(result.data);
    } catch {
      setError("預覽失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadPreview() {
    if (previewData) {
      downloadCsv(previewData, "export.csv");
      void loadAuditLogs();
    }
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

  function handleLoadCustomPreset(name: string) {
    const result = loadPreset(name);
    if (!result) return;
    setQuery(result.query);
    setSelectedColumns(result.columns);
    persistLastUsed(result.query, result.columns);
  }

  function handleSaveAsPreset() {
    const name = prompt("請輸入預設名稱");
    if (name === null) return;
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
    <div>
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Preset buttons */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>快速匯出</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            點擊下方按鈕直接下載常用格式的 CSV 檔案，無需額外設定。
          </p>
          <div className="flex flex-wrap gap-2">
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
              匯入 Google 通訊錄
            </Button>

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

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveAsPreset}
          >
            儲存為預設
          </Button>
        </CardContent>
      </Card>

      {/* Custom export filters */}
      <div className="mb-6 rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-foreground mb-3">篩選條件</h2>
        <FormGrid>
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

      <div className="flex gap-2">
        <Button
          onClick={handlePreview}
          disabled={loading}
          variant="outline"
        >
          {loading ? "載入中..." : "預覽"}
        </Button>
        <Button
          onClick={handleCustomExport}
          disabled={loading}
        >
          {loading ? "匯出中..." : "自訂匯出"}
        </Button>
      </div>

      {/* Preview table */}
      {previewData && (
        <div className="mt-4 rounded-md border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground">
              預覽（共 {previewData.length} 筆，顯示前 5 筆）
            </h2>
            <Button size="sm" onClick={handleDownloadPreview}>
              下載全部 CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  {Object.keys(previewData[0] ?? {}).map((col) => (
                    <th key={col} className="pb-2 pr-4 font-medium whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="py-2 pr-4 whitespace-nowrap">
                        {val == null ? "—" : String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

// ── Main Page Component (Task 7.1) ──

export default function ExportPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  return (
    <PageContainer>
      <PageHeader title="資料匯入/匯出" />

      {isAdmin ? (
        <Tabs defaultValue="import">
          <TabsList className="grid w-full grid-cols-2 h-11">
            <TabsTrigger value="import" className="text-base">匯入</TabsTrigger>
            <TabsTrigger value="export" className="text-base">匯出</TabsTrigger>
          </TabsList>

          <TabsContent value="import">
            <ImportSection />
          </TabsContent>

          <TabsContent value="export">
            <ExportSection />
          </TabsContent>
        </Tabs>
      ) : (
        <ExportSection />
      )}
    </PageContainer>
  );
}
