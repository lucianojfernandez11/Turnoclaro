# TurnoClaro · estado del proyecto

Última actualización: 30 de octubre de 2026.

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

## Próximos pasos (en este orden)

1. **"Olvidé mi contraseña"** por email (y mail de bienvenida).
2. **Términos y condiciones y política de privacidad** (Ley 25.326), revisados por un abogado.
3. **Seguridad:** cambiar la contraseña de la base en Neon y la del superadmin (está en `.env`).
4. **Publicar en internet:** GitHub + Vercel con la base de Neon, y dominio propio (`.com.ar` en NIC Argentina).
5. **Material de venta:** PDF de una página y demo al día (`npm run db:seed`).
6. **WhatsApp automático:** verificar Meta Business y la plantilla `recordatorio_turno`.
7. **Más adelante:** cobro con Mercado Pago, carga automática de los 500 recordatorios del plan Clínica, rediseño de Ajustes, Reportes y Plataforma, actualizar Next.js.

## Datos útiles

- Carpeta en la compu: `Mis desarrollos webs\turnoclaro-app` · se prende con `npm run dev` desde la terminal de VS Code (la demo vieja sigue en `turnoclaro`).
- Demo: `demo@turnoclaro.com` / `demo1234` · reservas en `/r/demo`.
- La conexión a Neon está en `.env` (no se sube a GitHub).
