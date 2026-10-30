import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Neon (plan gratis) apaga la base después de unos minutos sin uso y corta las
 * conexiones abiertas. La primera consulta después de esa pausa puede fallar con
 * "Server has closed the connection" o tardar en despertar la base.
 * Acá reintentamos esas consultas solas, así la pantalla no muestra un error.
 */
const READS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);
// P1001: no se pudo conectar · P1002/P1008: tiempo agotado · P1017: la base cortó la conexión · P2024: no hubo conexión libre a tiempo
const CONNECTION_ERRORS = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

function isConnectionError(e: unknown): { code: string } | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && CONNECTION_ERRORS.has(e.code)) return { code: e.code };
  if (e instanceof Prisma.PrismaClientInitializationError) return { code: e.errorCode ?? "INIT" };
  if (e instanceof Prisma.PrismaClientUnknownRequestError && /closed the connection|Connection reset|terminating connection/i.test(e.message)) {
    return { code: "CLOSED" };
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createClient() {
  return new PrismaClient().$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (e) {
            const err = isConnectionError(e);
            // Las lecturas se pueden repetir sin riesgo. Las escrituras solo si ni siquiera llegó a conectarse.
            const safe = READS.has(operation) || err?.code === "P1001" || err?.code === "INIT";
            if (!err || !safe || attempt >= 3) throw e;
            await sleep(400 * (attempt + 1));
          }
        }
      },
    },
  });
}

// Una sola instancia (en desarrollo Next recarga módulos y abriría conexiones de más).
const globalForPrisma = globalThis as unknown as { prismaConReintentos?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prismaConReintentos ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaConReintentos = prisma;
