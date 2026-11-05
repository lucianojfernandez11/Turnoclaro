# TurnoClaro · estado del proyecto

Última actualización: 5 de noviembre de 2026.

## Dónde estamos

El sistema funciona completo en la compu (localhost) con la base PostgreSQL en Neon (São Paulo) y tiene el diseño final aprobado. Falta publicarlo en internet para poder venderlo.

## Hecho

| Parte | Estado |
| --- | --- |
| Base de datos (PostgreSQL + Prisma), varios consultorios separados | Listo. La base impide turnos superpuestos |
| Login, registro con prueba de 14 días, roles (administración, secretaría, profesional) | Listo |
| Agenda por día y semana, turnos, sobreturnos, bloqueos y feriados | Listo |
| Pacientes: ficha, buscador, historial, importación desde Excel (CSV) | Listo |
| Reserva online del paciente (`/r/<consultorio>`) y solicitudes | Listo |
| Recordatorios por WhatsApp en modo manual + link para que el paciente confirme o cancele | Listo |
| Recordatorios automáticos con la API oficial de Meta (webhook y tarea de las 19 h) | Programado, falta configurar la cuenta de Meta |
| Reportes de ausentismo y panel de superadmin (`/plataforma`) | Listo |
| Diseño: portada para vender con simulador, login animado, panel, celular | Listo y aprobado |
| Arranque desde la terminal de VS Code (`npm run dev`), ver README | Listo |

## Hecho el 30/10

Precios nuevos ($80.000 / $120.000 / $250.000) con botón por plan y precio por profesional; packs redondeados ($40.000 / $75.000 / $175.000) y 500 recordatorios incluidos en el plan Clínica; tarjetas de la agenda que abren su detalle; pestañas lunes a viernes; tarjetas de profesional desplegables; horarios libres en verde que titilan; frase del día; pie de página con firma DEV; arranque más rápido (Turbopack) y reintento automático cuando Neon se duerme.

## Hecho el 5/11

- **Publicado en internet:** https://turnoclaro-alpha.vercel.app (Vercel, conectado al repo privado de GitHub: cada `git push` publica solo).
- **Demo pública:** https://turnoclaro-alpha.vercel.app/demo (solo lectura, se regenera todos los días).
- Next.js actualizado a 15.5.x por la falla de seguridad CVE-2025-66478.
- Contraseña de la base (Neon) y del superadmin cambiadas.
- Agregado al portfolio como proyecto principal.

## Próximos pasos (en este orden)

1. ~~"Olvidé mi contraseña" y mail de bienvenida~~ (hecho; falta el punto 3 para que lleguen los mails).
2. **Términos y condiciones y política de privacidad** (Ley 25.326), revisados por un abogado.
3. **Emails reales:** cuenta en Resend y `RESEND_API_KEY` en Vercel (sin esto no funciona "Olvidé mi contraseña" en la web).
4. **Dominio propio** (`.com.ar` en NIC Argentina) y conectarlo en Vercel.
4b. **Base de prueba separada:** hoy la compu y la web usan la MISMA base. Crear una rama en Neon para probar en la compu.
4c. **Pantalla de bienvenida** para consultorios nuevos (3 pasos guiados).
5. **Material de venta:** PDF de una página y demo al día (`npm run db:seed`).
6. **WhatsApp automático:** verificar Meta Business y la plantilla `recordatorio_turno`.
7. **Más adelante:** cobro con Mercado Pago, carga automática de los 500 recordatorios del plan Clínica, rediseño de Ajustes, Reportes y Plataforma, pasar a Next.js 16.

## Datos útiles

- Carpeta en la compu: `Mis desarrollos webs\turnoclaro-app` · se prende con `npm run dev` desde la terminal de VS Code (la demo vieja sigue en `turnoclaro`).
- Demo: `demo@turnoclaro.com` / `demo1234` · reservas en `/r/demo`.
- La conexión a Neon está en `.env` (no se sube a GitHub).
