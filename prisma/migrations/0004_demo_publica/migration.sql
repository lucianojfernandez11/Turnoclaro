-- Sesiones de la demo pública: solo lectura y de corta duración.
ALTER TABLE "Session" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
