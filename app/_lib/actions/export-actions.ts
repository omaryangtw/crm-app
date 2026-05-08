"use server";

import { prisma } from "../db";
import { auth } from "../auth";
import { buildExportWhereClause } from "../utils/export-utils";
import { exportCriteriaSchema } from "../schemas/export-schema";
import { createAuditLogEntry } from "../audit/audit-service";
import type { ExportCriteria } from "../schemas/export-schema";
import type { ActionResult } from "./auth-actions";

// ── Export formatting helpers ──

const COLUMN_LABELS: Record<string, string> = {
  name: "姓名", nameAlt: "別名", idn: "身分證字號", sex: "性別",
  birthday: "生日", isDead: "已歿", householdAdmin: "戶長",
  incomeStatus: "收入狀態", disabledStatus: "身障狀態",
  indigenousGroup: "族別", tribe: "部落", plainMountain: "平原/山原",
  canCall: "可電聯", phone: "電話", phoneNote: "電話備註",
  phoneAlt: "電話(備)", phoneAltNote: "電話(備)備註",
  mobile: "手機", mobileNote: "手機備註",
  mobileAlt: "手機(備)", mobileAltNote: "手機(備)備註",
  canMail: "可郵寄", city: "縣市", cityAlt: "縣市(備)",
  dist: "區", distAlt: "區(備)", vill: "里", villAlt: "里(備)",
  addr: "地址", addrAlt: "地址(備)", addrNote: "地址備註",
  addrAltNote: "地址(備)備註", note: "備註",
};

const SEX_MAP: Record<string, string> = { male: "男", female: "女" };
const INCOME_MAP: Record<string, string> = { low: "低收", "mid-low": "中低收", "mid-low-elderly": "中低老", mid_low: "中低收", mid_low_elderly: "中低老" };
const DISABLED_MAP: Record<string, string> = { light: "輕度", mid: "中度", heavy: "重度" };
const GROUP_MAP: Record<string, string> = {
  amis: "阿美", atayal: "泰雅", bunun: "布農", kanakanavu: "卡那卡那富",
  kavalan: "噶瑪蘭", paiwan: "排灣", puyuma: "卑南", rukai: "魯凱",
  hla_alua: "拉阿魯哇", saisiyat: "賽夏", sakizaya: "撒奇萊雅",
  seediq: "賽德克", truku: "太魯閣", thao: "邵", tsou: "鄒", yami: "雅美",
};
const PLAIN_MAP: Record<string, string> = { plain: "平原", mountain: "山原" };

function formatExportValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "boolean") return value ? "是" : "否";
  if (key === "sex") return SEX_MAP[value as string] ?? value;
  if (key === "incomeStatus") return INCOME_MAP[value as string] ?? value;
  if (key === "disabledStatus") return DISABLED_MAP[value as string] ?? value;
  if (key === "indigenousGroup") return GROUP_MAP[value as string] ?? value;
  if (key === "plainMountain") return PLAIN_MAP[value as string] ?? value;
  return value;
}

/**
 * Export clients based on filter criteria.
 * Admin-only — returns "權限不足" for unauthorized users.
 */
export async function exportClients(
  criteria: ExportCriteria,
  options?: { preview?: boolean },
): Promise<ActionResult<Record<string, unknown>[]>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "權限不足" };
  }

  const parsed = exportCriteriaSchema.safeParse(criteria);
  if (!parsed.success) {
    return { success: false, error: "匯出條件格式錯誤" };
  }

  const { query, attributes, flag } = parsed.data;

  // Google Contacts preset
  if (flag === "contacts") {
    return exportGoogleContacts(session);
  }

  const where = buildExportWhereClause(query);

  // Build select from attributes (only true values)
  const selectedColumns = Object.entries(attributes)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  // Always include id for reference
  const select: Record<string, boolean> = { id: true };
  for (const col of selectedColumns) {
    select[col] = true;
  }

  try {
    const clients = await prisma.client.findMany({
      where: { ...where, id: { not: 0 } },
      select,
    });

    // Format data for export: Chinese headers, ISO dates, Chinese enum values
    const formatted = clients.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (key === "id") { out["ID"] = value; continue; }
        const label = COLUMN_LABELS[key] ?? key;
        out[label] = formatExportValue(key, value);
      }
      return out;
    });

    const userId = parseInt(session.user.id ?? "0", 10);
    const userEmail = session.user.email ?? "";
    if (!options?.preview) {
      await createAuditLogEntry({
        entityType: "Export",
        entityId: 0,
        action: "EXPORT",
        userId,
        userEmail,
        oldData: null,
        newData: {
          type: "custom",
          filters: query,
          columns: selectedColumns,
          resultCount: formatted.length,
        },
        changedFields: [],
      });
    }

    return {
      success: true,
      data: formatted,
    };
  } catch {
    return { success: false, error: "匯出失敗，請稍後再試" };
  }
}

/**
 * Export all living clients with addresses in Google Contacts format.
 */
async function exportGoogleContacts(
  session: { user: { id?: string; email?: string | null } },
): Promise<
  ActionResult<Record<string, unknown>[]>
> {
  try {
    const clients = await prisma.client.findMany({
      where: {
        id: { not: 0 },
        isDead: false,
        addr: { not: null },
      },
      include: {
        contacts: {
          select: { record: true, date: true },
          orderBy: { date: "asc" },
        },
      },
    });

    const data = clients.map((client) => {
      const notes = client.contacts
        .map((c) => c.record ?? "")
        .filter((r) => r.length > 0)
        .join("\n");

      const homeAddress = [
        client.city ?? "",
        client.dist ?? "",
        client.vill ?? "",
        client.addr ?? "",
      ].join("");

      return {
        "First Name": client.name ?? "",
        "Middle Name": client.nameAlt ?? "",
        Birthday: client.birthday
          ? client.birthday.toISOString().split("T")[0]
          : "",
        "Mobile Phone": client.mobile ?? "",
        "Other Phone": client.mobileAlt ?? "",
        "Business Phone": client.phone ?? "",
        "Business Phone 2": client.phoneAlt ?? "",
        "Home Address": homeAddress,
        Notes: notes,
      };
    });

    const userId = parseInt(session.user.id ?? "0", 10);
    const userEmail = session.user.email ?? "";
    await createAuditLogEntry({
      entityType: "Export",
      entityId: 0,
      action: "EXPORT",
      userId,
      userEmail,
      oldData: null,
      newData: { type: "googleContacts", resultCount: data.length },
      changedFields: [],
    });

    return {
      success: true,
      data: data as unknown as Record<string, unknown>[],
    };
  } catch {
    return { success: false, error: "匯出失敗，請稍後再試" };
  }
}
