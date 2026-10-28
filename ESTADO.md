# TurnoClaro · estado del proyecto

Última actualización: 28 de octubre de 2026.

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
| Recordatorios: 3 modos por consultorio (con un toque gratis, packs de TurnoClaro, número propio del consultorio) en Ajustes › WhatsApp | Listo. A quien ya confirmó no se le escribe |
| Packs: saldo por consultorio, se carga desde /plataforma | Listo. Los envíos automáticos necesitan la cuenta de Meta |
| Agenda rediseñada para la secretaría | Listo |
| Reportes de ausentismo y panel de superadmin (`/plataforma`) | Listo |
| Diseño: portada para vender con simulador, login animado, panel, celular | Listo y aprobado |
| Scripts de Windows: INICIAR, APAGAR, DEMO-AL-DIA | Listo |

## Próximos pasos (en este orden)

1. **Publicar en internet:** subir el código a GitHub y conectarlo a Vercel, con la misma base de Neon. Resultado: un link para mandar a los consultorios.
2. **Revisar precios, packs y WhatsApp de ventas** en `src/lib/brand.ts` (Meta cobra ≈ $37,68 por recordatorio automático desde el 1/10/2026).
3. **Seguridad antes de cargar pacientes reales:** cambiar la contraseña de la base en Neon (quedó escrita en el chat) y la del superadmin.
4. **WhatsApp automático:** cuenta de Meta Business verificada, número propio y plantilla `recordatorio_turno` (pasos en el README).
5. **Antes de cobrar:** términos y condiciones, política de privacidad y contrato con los consultorios (ver documento de definición).
6. Más adelante: recuperar contraseña por email, cobro de la suscripción con Mercado Pago, lista de espera.

## Datos útiles

- Carpeta en la compu: `Mis desarrollos webs\turnoclaro-app` (la demo vieja sigue en `turnoclaro`).
- Demo: `demo@turnoclaro.com` / `demo1234` · reservas en `/r/demo`.
- La conexión a Neon y la clave SECRETS_KEY están en `.env` (no se sube a GitHub). Al publicar en Vercel hay que cargar SECRETS_KEY con el mismo valor.
