export type EntityType = "Client" | "Case" | "Contact" | "Export" | "Import";

export type ActionType = "CREATE" | "UPDATE" | "DELETE" | "DELETE_REQUESTED" | "DELETE_REJECTED" | "RESTORE" | "EXPORT" | "IMPORT";

export interface CreateAuditLogParams {
  entityType: EntityType;
  entityId: number;
  action: ActionType;
  userId: number;
  userEmail: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedFields: string[];
}
