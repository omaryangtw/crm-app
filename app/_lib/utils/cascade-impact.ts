import { prisma } from "../db";
import type { EntityType } from "../audit/audit-types";

export interface CascadeImpact {
  cases: number;
  contacts: number;
  todos: number;
  familyRelations: number;
  photos: number;
}

const ZERO_IMPACT: CascadeImpact = {
  cases: 0,
  contacts: 0,
  todos: 0,
  familyRelations: 0,
  photos: 0,
};

export async function getCascadeImpact(
  entityType: EntityType,
  entityId: number
): Promise<CascadeImpact> {
  switch (entityType) {
    case "Client": {
      const client = await prisma.client.findUnique({
        where: { id: entityId },
        select: {
          _count: {
            select: {
              cases: true,
              contacts: true,
              todos: true,
              photos: true,
              familyRelationsAsA: true,
              familyRelationsAsB: true,
            },
          },
        },
      });
      if (!client) return { ...ZERO_IMPACT };
      const c = client._count;
      return {
        cases: c.cases,
        contacts: c.contacts,
        todos: c.todos,
        familyRelations: c.familyRelationsAsA + c.familyRelationsAsB,
        photos: c.photos,
      };
    }
    case "Case": {
      const contacts = await prisma.contact.count({
        where: { caseId: entityId },
      });
      return { ...ZERO_IMPACT, contacts };
    }
    case "Contact":
      return { ...ZERO_IMPACT };
    default:
      return { ...ZERO_IMPACT };
  }
}
