"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { auth } from "../auth";
import { getInverseRelationship } from "../constants/relationship-map";
import type { ActionResult } from "./auth-actions";

export async function createFamilyRelation(
  sourceId: number,
  targetId: number,
  relationship: string
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  if (sourceId === targetId) {
    return { success: false, error: "不能與自己建立家庭關係" };
  }

  // Look up source client's sex for inverse computation
  const sourceClient = await prisma.client.findUnique({
    where: { id: sourceId },
    select: { sex: true },
  });

  if (!sourceClient) {
    return { success: false, error: "找不到來源族人" };
  }

  if (!sourceClient.sex) {
    return { success: false, error: "來源族人未設定性別，無法計算反向關係" };
  }

  const inverse = getInverseRelationship(relationship, sourceClient.sex);

  // Check inverse direction to prevent duplicate (B,A) when (A,B) exists
  const existingInverse = await prisma.familyRelation.findFirst({
    where: { personAId: targetId, personBId: sourceId },
    select: { id: true },
  });
  if (existingInverse) {
    return { success: false, error: "此家庭關係已存在" };
  }

  try {
    // Single row stores both directions: A→B and B→A
    const record = await prisma.familyRelation.create({
      data: {
        personAId: sourceId,
        personBId: targetId,
        relationAToB: relationship,
        relationBToA: inverse,
      },
    });

    revalidatePath(`/clients/${sourceId}`);
    revalidatePath(`/clients/${targetId}`);
    return { success: true, data: { id: record.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return { success: false, error: "此家庭關係已存在" };
      if (err.code === "P2003") return { success: false, error: "關聯族人不存在" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function deleteFamilyRelation(
  id: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  try {
    const relation = await prisma.familyRelation.delete({ where: { id } });
    revalidatePath(`/clients/${relation.personAId}`);
    revalidatePath(`/clients/${relation.personBId}`);
    return { success: true, data: null };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return { success: false, error: "找不到資料" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}
