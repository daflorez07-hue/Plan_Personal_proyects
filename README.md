# Derrotero

Aplicación personal para seguir el plan de David Flórez Sierra entre septiembre de 2026 y junio de 2027: qué hacer esta semana, qué va tarde y si el plan llega con evidencia a la decisión de marzo de 2027 sobre IKM.

**App publicada:** https://claude.ai/artifact/9um4cXzwmWWsrYiqm6L7AB (privada; se comparte desde el menú Compartir).

## Qué trae

| Módulo | Requisito | Qué hace |
|---|---|---|
| Hoy | RF-01 | Avance total, vencidas, próximos 7 días, días a la revisión 1, veredictos, indicadores y hábitos |
| Agenda por voz | nuevo | Dictas o escribes una frase en español ("mañana a las 3 de la tarde reunión con Cristian, recuérdame 30 minutos antes"), la app la convierte en actividad con fecha, hora, duración, aviso y frente; te recuerda antes, la marca vencida si pasa sin hacerse y la exporta al calendario con alarma |
| Actividades | RF-01, RF-02, RF-05 | CRUD, filtros por frente, estado, responsable, vencidas y texto; orden arrastrando; vistas "Próximos 7 días" y "Vencidas"; bloqueada protegida (H-04) |
| Puntos de control | RF-03 | Sí / parcial / no por condición, criterio medible (RN-06), evidencia con enlace, veredicto (RN-02) y registro de la decisión (H-06) |
| Indicadores | RF-04 | Movimientos fechados, meta, plazo y gráfica de tendencia (H-03); nunca bajan de cero (RN-05) |
| Hábitos | RF-08 | Diario, semanal, quincenal y mensual, con marca de cumplimiento y racha (H-05) |
| Frentes por modo | RF-09 | Validación de máximo dos en Construir (RN-03) y revisión trimestral |
| Semana tipo | RF-10 | Bloques editables por día y hora, exportación `.ics` con repetición semanal |
| Laboratorio | RF-11 | Proyecto por trimestre, criterio de salida y decisión (RN-04) |
| Resumen semanal | RF-12 | Texto listo para copiar, `.md` y PDF (H-10) |
| Bitácora | RF-06 | Quién, qué, cuándo, antes y después (H-02) |
| Ajustes | RF-07 | Etapas, frentes, metas y ventanas editables (H-01); exportación JSON y respaldo diario |

## Arquitectura

Una página HTML publicada como artefacto de Claude, con la base de documentos del artefacto (`db`) como almacenamiento compartido y en vivo. Sin servidor propio, sin credenciales en el código.

```
src/logic.js    reglas de negocio puras (fechas en America/Bogota, RN-01 a RN-06, intérprete de frases, .ics)
src/store.js    estado, suscripciones en vivo, escritura en cola por documento, bitácora, respaldo diario
src/ui.js       vistas
src/app.js      eventos, agenda por voz, recordatorios, exportaciones
src/styles.css  sistema visual de la marca personal (papel, Crudo, Verde petróleo, Llama; Archivo + IBM Plex Mono)
data/seed.json  plan base (sección 6 del documento de requisitos), generado por data/build-seed.js
build.js        empaqueta todo en dist/derrotero.html
```

Colecciones: `config/main`, `tasks`, `kpis/main`, `kpi_events`, `checkpoints`, `decisions`, `habits`, `habit_logs`, `blocks`, `lab`, `agenda`, `audit` (un documento por día), `backups` (uno por día, se conservan 14).

Regla de acceso: cualquiera con acceso lee; solo el dueño y los editores escriben.

## Probar

```bash
npm test                                   # 16 pruebas de lógica (node:test)
NODE_PATH=$(npm root -g) npm run test:e2e  # navegador: criterios de aceptación 1–6 y 8, agenda, recordatorio y vencimiento
```

## Publicar una nueva versión

`npm run build` y volver a publicar `dist/derrotero.html` sobre la misma URL del artefacto. Los datos viven en la base del artefacto y no se pierden al republicar.

Ver `docs/manual.md` (uso en una página) y `docs/trazabilidad.md` (estado de cada requisito y decisiones pendientes).
