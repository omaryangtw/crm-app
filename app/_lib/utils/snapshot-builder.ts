import { prisma } from "../db";
import { serializeEntity } from "../audit/audit-service";
import type { EntityType } from "../audit/audit-types";

export type CascadeEntityType =
  | "Case"
  | "Contact"
  | "Todo"
  | "FamilyRelation"
  | "ClientPhoto";

export interface EntitySnapshot {
  entity: Record<string, unknown>;
  relatedRecords?: {
    cases?: Record<string, unknown>[];
    contacts?: Record<string, unknown>[];
    todos?: Record<string, unknown>[];
    familyRelations?: Record<string, unknown>[];
    photos?: Record<string, unknown>[];
  };
}

export async function buildEntitySnapshot(
  entityType: EntityType,
  entityId: number,
  cascadeSelection: CascadeEntityType[]
): Promise<EntitySnapshot | null> {
  switch (entityType) {
    case "Client":
      return buildClientSnapshot(entityId, cascadeSelection);
    case "Case":
      return buildCaseSnapshot(entityId);
    case "Contact":
      return buildContactSnapshot(entityId);
    default:
      return null;
  }
}

async function buildClientSnapshot(
  clientId: number,
  cascadeSelection: CascadeEntityType[]
): Promise<EntitySnapshot | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });
  if (!client) return null;

  const selected = new Set(cascadeSelection);
  const relatedRecords: EntitySnapshot["relatedRecords"] = {};

  if (selected.has("Case")) {
    const cases = await prisma.case.findMany({
      where: { clientId },
    });
    relatedRecords.cases = cases.map(serializeEntity);
  }

  if (selected.has("Contact")) {
    const contacts = await prisma.contact.findMany({
      where: { clientId },
    });
    relatedRecords.contacts = contacts.map(serializeEntity);
  }

  if (selected.has("Todo")) {
    const todos = await prisma.todo.findMany({
      where: { clientId },
    });
    relatedRecords.todos = todos.map(serializeEntity);
  }

  if (selected.has("FamilyRelation")) {
    const familyRelations = await prisma.familyRelation.findMany({
      where: {
        OR: [{ personAId: clientId }, { personBId: clientId }],
      },
    });
    relatedRecords.familyRelations = familyRelations.map(serializeEntity);
  }

  if (selected.has("ClientPhoto")) {
    const photos = await prisma.clientPhoto.findMany({
      where: { clientId },
    });
    relatedRecords.photos = photos.map(serializeEntity);
  }

  const hasRelated = Object.keys(relatedRecords).length > 0;

  return {
    entity: serializeEntity(client as unknown as Record<string, unknown>),
    ...(hasRelated ? { relatedRecords } : {}),
  };
}

async function buildCaseSnapshot(
  caseId: number
): Promise<EntitySnapshot | null> {
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
  });
  if (!caseRecord) return null;

  return {
    entity: serializeEntity(caseRecord as unknown as Record<string, unknown>),
  };
}

async function buildContactSnapshot(
  contactId: number
): Promise<EntitySnapshot | null> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });
  if (!contact) return null;

  return {
    entity: serializeEntity(contact as unknown as Record<string, unknown>),
  };
}
