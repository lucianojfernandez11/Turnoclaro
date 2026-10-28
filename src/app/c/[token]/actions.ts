"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { applyPatientReply } from "@/lib/reminders";

export async function patientReplyAction(token: string, reply: "CONFIRMA" | "CANCELA"): Promise<void> {
  if (reply !== "CONFIRMA" && reply !== "CANCELA") return;
  const appt = await prisma.appointment.findUnique({ where: { publicToken: token }, select: { id: true } });
  if (!appt) redirect("/");
  const result = await applyPatientReply({ appointmentId: appt.id, reply, via: "link" });
  revalidatePath("/panel", "layout");
  redirect(`/c/${token}?r=${encodeURIComponent(result.message)}`);
}
