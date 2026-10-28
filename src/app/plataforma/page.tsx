import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isWhatsappApiConfigured } from "@/lib/whatsapp";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { addCreditsAction, enterClinicAction, updateClinicPlanAction } from "./actions";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = { title: "Plataforma" };

export default async function PlataformaPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) redirect("/login");
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const clinics = await prisma.clinic.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { professionals: true, patients: true, memberships: true } },
    },
  });
  const usage = await prisma.appointment.groupBy({
    by: ["clinicId"],
    where: { createdAt: { gt: monthAgo } },
    _count: { _all: true },
  });
  const msgs = await prisma.message.groupBy({
    by: ["clinicId"],
    where: { createdAt: { gt: monthAgo }, channel: "API", status: { not: "FALLIDO" } },
    _count: { _all: true },
  });

  return (
    <main className="main" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="stack">
        <PageHeader
          title="Plataforma"
          subtitle={`${clinics.length} consultorios · WhatsApp automático ${isWhatsappApiConfigured() ? "activado" : "sin configurar"}`}
          actions={
            <form action={logoutAction}>
              <button className="btn" type="submit">Salir</button>
            </form>
          }
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Consultorio</th>
                <th>Uso (30 días)</th>
                <th>Plan</th>
                <th>WhatsApp</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clinics.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <div className="small muted">
                      /r/{c.slug} · alta {c.createdAt.toLocaleDateString("es-AR")}
                      <br />
                      {c._count.professionals} profesionales · {c._count.memberships} usuarios · {c._count.patients} pacientes
                    </div>
                  </td>
                  <td className="small">
                    {usage.find((u) => u.clinicId === c.id)?._count._all ?? 0} turnos creados
                    <br />
                    {msgs.find((u) => u.clinicId === c.id)?._count._all ?? 0} WhatsApp automáticos
                  </td>
                  <td>
                    <ActionForm action={updateClinicPlanAction.bind(null, c.id)} className="stack" >
                      <select name="plan" defaultValue={c.plan}>
                        <option value="PRUEBA">Prueba</option>
                        <option value="PROFESIONAL">Profesional</option>
                        <option value="CONSULTORIO">Consultorio</option>
                        <option value="CLINICA">Clínica</option>
                      </select>
                      <label className="check small">
                        <input type="checkbox" name="active" defaultChecked={c.active} /> Activo
                      </label>
                      <label className="small">
                        Extender prueba (días) <input name="trialDays" type="number" min={0} max={90} placeholder="0" />
                      </label>
                      {c.plan === "PRUEBA" && c.trialEndsAt ? (
                        <span className="small muted">Vence {c.trialEndsAt.toLocaleDateString("es-AR")}</span>
                      ) : null}
                      <SubmitButton className="btn btn-sm">Guardar</SubmitButton>
                    </ActionForm>
                  </td>
                  <td className="small">
                    <b>{c.waMode === "PACK" ? "Packs" : c.waMode === "PROPIA" ? "Cuenta propia" : "Con un toque"}</b>
                    <div className="muted">Saldo: {c.reminderCredits.toLocaleString("es-AR")}</div>
                    <ActionForm action={addCreditsAction.bind(null, c.id)} className="row" resetOnSuccess>
                      <input name="amount" type="number" step={1} placeholder="500" style={{ width: 90 }} aria-label="Recordatorios a cargar" />
                      <SubmitButton className="btn btn-sm">Cargar</SubmitButton>
                    </ActionForm>
                  </td>
                  <td>
                    <form action={enterClinicAction.bind(null, c.id)}>
                      <button className="btn btn-sm" type="submit">Entrar como soporte</button>
                    </form>
                    <Link className="small" href={`/r/${c.slug}`} target="_blank">Ver reservas</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
