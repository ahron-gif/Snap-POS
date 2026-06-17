export interface AuditLogGridItem {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  changedFields: string | null;
  createdAt: string;
}

export interface AuditLogDetail {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedFields: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}
