# TurnoClaro

Sistema de turnos para consultorios y clínicas: agenda por profesional, recordatorios por WhatsApp que el paciente confirma o cancela con un toque, y reserva online desde un link propio de cada consultorio. Varios consultorios en la misma instalación, cada uno con sus datos separados.

## Qué incluye

| Módulo | Qué hace |
| --- | --- |
| Cuentas | Registro con prueba de 14 días, login, roles (administración, secretaría, profesional), bloqueo tras 5 intentos fallidos |
| Agenda | Vista por día con una columna por profesional, semana a la vista, turnos, sobreturnos, bloqueos y feriados. La base de datos impide que dos turnos se pisen |
| Turnos | Dar, mover, cancelar, reactivar, marcar confirmado, atendido o ausente. Historial de cada cambio |
| Pacientes | Ficha, buscador, historial de turnos, importación desde Excel (CSV) |
| Recordatorios | Modo automático con la API oficial de WhatsApp (sale todos los días a las 19 h) o modo manual (abre WhatsApp con el mensaje listo). En los dos casos el paciente recibe un link para confirmar o cancelar, y la agenda se actualiza sola |
| Reserva online | `/r/<consultorio>`: el paciente elige profesional, día y horario libre. Queda como solicitud para la secretaría o se confirma al instante, según la configuración |
| Reportes | Turnos del mes, ausentismo, confirmaciones por WhatsApp, por profesional |
| Plataforma | `/plataforma`: vos (superadmin) ves todos los consultorios, su uso, cambiás el plan, suspendés y entrás como soporte |

## Tecnologías

- **Next.js 15** (App Router, Server Actions) con **React 19** y **TypeScript**.
- **PostgreSQL** con **Prisma 6** como ORM.
- Sesiones propias con cookie `httpOnly`; contraseñas con `scrypt` (incluido en Node, sin librerías extra).
- **WhatsApp Cloud API** de Meta para el envío automático.
- Sin otras dependencias: fechas, zonas horarias, CSV y validaciones están escritos a mano y tienen pruebas (`npm test`).

## Uso diario en tu compu (desde la terminal de VS Code)

Abrí la carpeta del proyecto en VS Code y la terminal con **Ctrl + ñ**.

| Comando | Para qué |
| --- | --- |
| `npm run dev` | Prende TurnoClaro en http://localhost:3000 (dejá la terminal abierta) |
| **Ctrl + C** | Lo apaga (si pregunta, respondé `S`) |
| `npm run db:migrate` | Actualiza las tablas de la base cuando hay cambios en `prisma/` |
| `npm install` | Instala las librerías (solo si cambió `package.json`) |
| `.\DEMO-AL-DIA.bat` o `npm run db:seed` | Recrea el consultorio de demostración con turnos alrededor de hoy |

Ingreso de prueba: `demo@turnoclaro.com` / `demo1234` (administración) y `secretaria@turnoclaro.com` / `demo1234` (secretaría). Tu superadmin es el email y la contraseña de `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` en `.env`.

Si dice que el puerto 3000 está ocupado, quedó otra terminal con el sistema prendido: cerrala con Ctrl + C (o con el tachito de la terminal). Si la página muestra errores raros después de recibir archivos nuevos, apagalo, borrá la carpeta `.next` y volvé a correr `npm run dev`.

## Instalación desde cero (otra compu)

Necesitás **Node.js 20 o más nuevo** y una base **PostgreSQL** (gratis en [Neon](https://neon.tech): creás un proyecto, tocás **Connect**, apagás "Connection pooling" y copiás la conexión).

1. Copiá `.env.example` como `.env` y completá `DATABASE_URL`, `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD`.
2. En la terminal:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

Otros comandos: `npm test` (pruebas de la lógica), `npm run typecheck` (revisa tipos), `npm run build` (compila como en producción), `npm run db:studio` (ver la base en el navegador).

## Diseño

- Fondo de vidrio verde con cintas bronce que flota y sigue el mouse: `src/components/glass.tsx` (+ `pointer-parallax.tsx`). Con "reducir movimiento" activado en el sistema operativo, queda quieto.
- Avisos de pacientes en vivo (login y portada): `src/components/patient-feed.tsx`.
- Simulador "Sos Juan" de la portada: `src/components/reminder-demo.tsx`.
- Colores, tipografías (Geist y Geist Mono) y todos los estilos: `src/app/globals.css`.
- **Precios, WhatsApp de ventas y ciudad de la portada:** `src/lib/brand.ts`.

## Publicarlo (Vercel + Neon)

1. Subí la carpeta a un repositorio de GitHub.
2. En [Vercel](https://vercel.com), "Add New Project", elegí el repositorio.
3. Cargá las variables de entorno de `.env` (con `APP_URL` = la dirección que te da Vercel o tu dominio).
4. Deploy. Después, desde tu compu, con el `.env` apuntando a la base de producción: `npm run db:migrate` y `npm run db:seed`.
5. El archivo `vercel.json` programa los recordatorios automáticos todos los días a las 22:00 UTC (19 h de Argentina). Vercel manda `CRON_SECRET` solo; no hace falta hacer nada más.

## WhatsApp automático (opcional)

Sin configurar nada, el sistema funciona en **modo manual**: la secretaría toca "Enviar" y se abre WhatsApp con el mensaje listo y el link de confirmación.

Para que los recordatorios salgan solos:

1. Creá una cuenta en [Meta for Developers](https://developers.facebook.com), una app de tipo "Business" y agregale el producto **WhatsApp**. Verificá tu empresa en Meta Business (tarda unos días).
2. Registrá un número de teléfono propio para TurnoClaro (no puede estar usándose en la app de WhatsApp).
3. Creá una plantilla de categoría **Utilidad**, idioma **Español (ARG)**, llamada `recordatorio_turno`:
   - Cuerpo: `Hola {{1}}, te recordamos tu turno con {{2}} el {{3}} a las {{4}} en {{5}}. ¿Vas a poder asistir?`
   - Botones de respuesta rápida, en este orden: `Confirmo` y `No puedo ir`.
4. Generá un token permanente (usuario del sistema) y cargá en el `.env` / Vercel: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` y un `WHATSAPP_VERIFY_TOKEN` inventado por vos.
5. En la configuración de WhatsApp de la app, poné el webhook `https://TU-DOMINIO/api/whatsapp/webhook` con ese mismo verify token, y suscribite al campo **messages**.

Cuando el paciente toca "Confirmo" o "No puedo ir", el turno cambia solo. Si responde escribiendo "sí" o "no", también se interpreta.

Costo de referencia (Meta, Argentina, desde octubre de 2026): unos USD 0,026 por mensaje de utilidad entregado.

## Estructura

```text
prisma/
  schema.prisma          modelo de datos
  migrations/            SQL de la base (incluye la regla "sin turnos superpuestos")
  seed.mjs, seed-data.mjs  superadmin y consultorio de demostración
src/
  lib/                   lógica: fechas, horarios libres, teléfonos, WhatsApp, sesiones
  app/
    login, registro      acceso
    panel/               agenda, turnos, pacientes, solicitudes, recordatorios, reportes, ajustes
    r/[slug]             reserva online del paciente
    c/[token]            link del paciente para confirmar o cancelar
    plataforma           tu panel de superadmin
    api/                 webhook de WhatsApp, tarea de recordatorios, buscador de pacientes
  components/            formularios y botones
```

## Pendiente para próximas versiones

- Recuperar contraseña por email (hoy la cambia la administración del consultorio).
- Cobro automático de la suscripción con Mercado Pago; hoy el plan y la suspensión se manejan a mano desde `/plataforma`, y el fin de la prueba gratis solo muestra un aviso.
- Lista de espera, turnos recurrentes y número de WhatsApp propio por consultorio.
- Seguridad a nivel de fila en PostgreSQL como segunda barrera (hoy el aislamiento entre consultorios lo hace el código, filtrando siempre por consultorio).
