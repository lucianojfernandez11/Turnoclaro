import { Prisma } from "@prisma/client";
import { prisma } from "./db";

/** Registro de cambios: quién hizo qué, sobre qué turno o paciente. */
export async function audit(params: {
  clinicId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        clinicId: params.clinicId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        detail: params.detail ? (params.detail as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (e) {
    // El registro nunca debe frenar la operación principal.
    console.error("audit", e);
  }
}
