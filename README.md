# Derrotero

Aplicación personal para seguir el plan de David Flórez Sierra entre septiembre de 2026 y junio de 2027: qué hacer esta semana, qué va tarde y si el plan llega con evidencia a la decisión de marzo de 2027 sobre IKM.

**App en Vercel:** https://derrotero-david-ricardo123.vercel.app (protegida con el inicio de sesión de Vercel).
**Versión artefacto de Claude:** https://claude.ai/artifact/9um4cXzwmWWsrYiqm6L7AB

## Qué trae

| Módulo | Requisito | Qué hace |
|---|---|---|
| Hoy | RF-01 | Tablero gráfico: el **camino del plan** (una persona camina de sep 2026 a jun 2027; sobre el camino, las actividades con fecha según su estado; junto a él, los recordatorios dictados y los eventos del calendario; en globos, lo que no tiene fecha), avance contra tiempo, estado de las actividades, el día en una línea de tiempo, carga de los próximos 7 días, medidores de metas con el ritmo esperado, avance por frente y anillos de hábitos |
| Agenda por voz | nuevo | Dictas o escribes una frase en español ("el jueves a las 10 primera sesión de entendimiento con cliente, recuérdame 30 minutos antes"), la app la convierte en actividad con fecha, hora, duración, aviso y frente; te recuerda antes, la marca vencida si pasa sin hacerse y la exporta al calendario con alarma |
| Actividades | RF-01, RF-02, RF-05 | CRUD, filtros por frente, estado, responsable, vencidas y texto; orden arrastrando; vistas "Próximos 7 días" y "Vencidas"; bloqueada protegida (H-04) |
| Indicadores | RF-04 | Movimientos fechados, meta, plazo y gráfica de tendencia (H-03); nunca bajan de cero (RN-05) |
| Hábitos | RF-08 | Diario, semanal, quincenal y mensual, con marca de cumplimiento y racha (H-05) |
| Frentes por modo | RF-09 | Validación de máximo dos en Construir (RN-03) y revisión trimestral |
| Semana tipo | RF-10 | Bloques editables por día y hora, exportación `.ics` con repetición semanal |
| Laboratorio | RF-11 | Proyecto por trimestre, criterio de salida y decisión (RN-04) |
| Resumen semanal | RF-12 | Texto listo para copiar, `.md` y PDF (H-10) |
| Bitácora | RF-06 | Quién, qué, cuándo, antes y después (H-02) |
| Ajustes | RF-07 | Conexiones (base de datos y calendario), etapas, frentes y metas editables (H-01); exportación JSON y respaldo diario |
| Calendario | nuevo | Lee tu Google Calendar u Outlook (dirección secreta iCal) y lo muestra en Hoy, en el camino y en la Agenda. Solo lectura: título, fecha y hora |

## Arquitectura

Sitio estático en Vercel con dos funciones:

- `api/db.js`: base de documentos sobre **Postgres (Neon, plan gratuito)**. Una tabla `derrotero_docs (coll, id, data jsonb, seq)`; el cliente sondea el número de revisión cada 12 s y trae los cambios de otros dispositivos.
- `api/calendar.js`: lee la dirección secreta iCal de `CALENDAR_ICS_URL` en el servidor, expande repeticiones y devuelve solo título, fecha y hora.

Acceso: el sitio y las funciones quedan detrás de **Vercel Authentication** en todos los dominios (solo tu cuenta de Vercel entra). Las funciones de datos además exigen un encabezado propio, lo que bloquea peticiones desde otros sitios. `/api/health` informa si la base y el calendario responden, solo con conteos.

Sin base de datos conectada la app funciona en modo local (localStorage). La misma página sigue funcionando como artefacto de Claude con su base propia.

```
api/db.js         base de documentos (Postgres/Neon), validación de colecciones, ids y tamaño
api/calendar.js   calendario personal por iCal (node-ical), solo lectura
src/logic.js      reglas de negocio puras (fechas en America/Bogota, RN-01, RN-03 a RN-05, intérprete de frases, .ics)
src/remote.js     cliente de /api/db con la misma forma que la base del artefacto
src/store.js      estado, escritura en cola, bitácora, respaldo diario, migración desde el navegador
src/ui.js         vistas
src/dash.js       tablero de Hoy: camino del plan e indicadores gráficos
src/inbox.js      pendientes que Claude registra desde las conversaciones (entran una sola vez)
src/app.js        eventos, agenda por voz, recordatorios, ayudas emergentes, exportaciones
src/styles.css    sistema visual de la marca personal
build.js          genera dist/derrotero.html (artefacto) y dist/web/index.html (Vercel)
```

Colecciones: `config/main`, `tasks`, `kpis/main`, `kpi_events`, `decisions`, `habits`, `habit_logs`, `blocks`, `lab`, `agenda`, `audit` (un documento por día), `backups` (uno por día, se conservan 14).

## Conectar la base de datos y el calendario

1. **Base de datos (gratis):** Vercel → proyecto `derrotero` → Storage → Create Database → **Neon** (Free) → Connect. Se crea `DATABASE_URL` y Vercel redespliega. Al abrir la app, la base está vacía: sube lo que tengas en el navegador o carga el plan base.
2. **Calendario:** Google Calendar → Configuración → tu calendario → Integrar el calendario → *Dirección secreta en formato iCal*. Outlook → Configuración → Calendario → Calendarios compartidos → Publicar un calendario → enlace ICS. Pégala en Vercel → Settings → Environment Variables → `CALENDAR_ICS_URL` y redespliega.

Ver `.env.example`. Ninguna credencial va en el repositorio.

## Probar

```bash
npm test                                          # lógica, funciones de Vercel y calendario (node:test)
PG_TEST_URL=postgres://… npm test                 # además, /api/db contra un Postgres real
NODE_PATH=$(npm root -g) npm run test:e2e         # navegador en modo local: criterios 1–3, 5, 6 y 8, agenda
PG_TEST_URL=postgres://… NODE_PATH=$(npm root -g) node test/e2e-vercel.js   # modo Vercel: Postgres, calendario, dos dispositivos
PG_TEST_URL=postgres://… CAL_FIXTURE=test/fixtures/calendario-rico.ics node test/dev-server.js   # servidor local
```

## Publicar una nueva versión

Vercel despliega solo con cada cambio en `main`. La versión artefacto se republica con `npm run build` y `dist/derrotero.html` sobre la misma URL.

Ver `docs/manual.md` (uso en una página) y `docs/trazabilidad.md` (estado de cada requisito y decisiones pendientes).
