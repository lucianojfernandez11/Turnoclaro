-- WhatsApp automático por consultorio y saldo de recordatorios (packs).
ALTER TABLE "Clinic" ADD COLUMN "waMode" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Clinic" ADD COLUMN "waPhoneNumberId" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "waTokenEnc" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "waAppSecretEnc" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "waVerifyToken" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "waTemplateName" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "waTemplateLang" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "reminderCredits" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Clinic_waPhoneNumberId_key" ON "Clinic"("waPhoneNumberId");
CREATE UNIQUE INDEX "Clinic_waVerifyToken_key" ON "Clinic"("waVerifyToken");

-- El saldo nunca puede quedar negativo.
ALTER TABLE "Clinic" ADD CONSTRAINT "Clinic_reminderCredits_check" CHECK ("reminderCredits" >= 0);
