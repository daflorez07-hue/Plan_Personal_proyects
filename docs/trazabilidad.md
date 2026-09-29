# Trazabilidad de requisitos · versión 2 (28 sep 2026)

## Cambios de la versión 2 (pedido de David, 28 sep 2026)
- Se retira el módulo **Puntos de control** (RF-03, RN-02, RN-06, H-06). Las fechas de revisión (15 ene) y decisión (31 mar) siguen como actividades t21 y t26.
- **Hoy** pasa a tablero gráfico con el camino del plan.
- Despliegue en **Vercel** con base **Postgres (Neon, gratis)** y lectura del **calendario** por iCal.
- Ejemplo de dictado: "primera sesión de entendimiento con cliente".


## Decisión de arquitectura
El documento sugería Next.js + PostgreSQL + Vercel. Se construyó como **artefacto de Claude con base de documentos propia** porque la instrucción fue dejarla lista y publicada en esta sesión, y ese stack exige credenciales que solo David puede escribir (regla 4) y aprobación de despliegue a producción. Consecuencias:

- Ganó: publicada hoy, base compartida en vivo entre celular y computador, sin secretos que custodiar, acceso de Claude al plan sin construir API, respaldo diario, reglas de acceso por rol.
- Perdió: API REST con token para sistemas externos (RF-13) y servidor MCP (RF-14). Emilia puede operar el plan a través de Claude, no por HTTP directo.

## Criterios de aceptación
| # | Criterio | Estado | Cómo se verifica |
|---|---|---|---|
| 1 | 29 actividades, 3 hechas, 10 %, vencidas según Bogotá | Cumple | `test/logic.test.js`, `test/e2e.js` |
| 2 | Toque pendiente → en curso queda en la bitácora | Cumple | e2e |
| 3 | Bloqueada no cambia con el toque; pide confirmación | Cumple | e2e |
| 4 | 3 sí → verde; 2 sí → "cumplimiento parcial (2 de 3)" | **Retirado en v2** | El módulo se eliminó a pedido de David |
| 5 | + crea movimiento fechado y la gráfica lo refleja | Cumple | e2e |
| 6 | Tercer frente en Construir muestra la advertencia RN-03 | Cumple | lógica + e2e |
| 7 | API rechaza sin token y permite con token | **No aplica en esta arquitectura** | El acceso lo controla la plataforma: escribir exige ser dueño o editor (verificado: un colaborador sin edición recibe rechazo) |
| 8 | 360 px sin desplazamiento horizontal | Cumple | e2e recorre las 11 vistas en 360 px (local) y 390 px (Vercel) |
| 9 | Sin secretos en el repositorio | Cumple | búsqueda antes del commit; `.env.example` sin valores; `DATABASE_URL` y `CALENDAR_ICS_URL` viven en Vercel |

## Requisitos funcionales
RF-01, RF-02 y RF-04 a RF-12: implementados. RF-03: retirado en v2. RF-13 y RF-14: pendientes (ver decisión de arquitectura).

## Limitaciones conocidas del visor
- **Micrófono:** el visor de artefactos puede bloquear el micrófono de la página. La app lo intenta y, si no hay acceso, indica usar el dictado del teclado del celular.
- **Avisos con la app cerrada:** una página no puede enviar notificaciones push. El aviso con la app cerrada lo hace el calendario del celular a partir del `.ics` con alarma o del evento creado en Google Calendar u Outlook.
- **Descargas:** el visor no admite `.ics` como descarga directa; se entrega dentro de un `.zip`.
- **Google Calendar:** el enlace crea el evento con el aviso predeterminado de tu calendario; el `.ics` sí lleva el aviso exacto que elegiste.

## Decisiones que necesito de David
1. Cifra de "más ventas": ≈ $1.000 millones (28 sep). `[POR CONFIRMAR]` periodo y si son ventas firmadas o facturadas. `[DATO REQUERIDO]` Esquema de la deuda, antes del 11 ene 2027. Se escriben en las notas de la actividad "Revisión 1 con IKM" (el módulo Puntos de control se retiró a pedido de David el 28 sep 2026).
2. Comité financiero: segundo martes de cada mes, 9:00 a. m. – 1:00 p. m. (28 sep). Quedó en la agenda de oct 2026 a jun 2027.
3. `[SUPUESTO DECLARADO]` Fechas de inicio y fin de cada etapa, duración del gimnasio (1 h), del comité de socios (1 h) y horario del bloque de familia del sábado. Editables en Ajustes y Semana tipo.
4. Criterios de salida de ZONAL y de MORALEJA (antes Berry Lab): aprobados por David el 28 sep. Falta verificar que MORALEJA esté libre en la SIC, dominio .co e Instagram.
5. Base de datos en Vercel: conectar Neon (Storage → Create Database) y escribir `CALENDAR_ICS_URL`. Ambas se configuran en Vercel; ninguna credencial pasa por el repositorio.


## v3 · 29 sep 2026 · Claude como "manos" dentro de la app
- Los cambios pedidos por chat pasan a ser **datos**, no código: `data/bandeja.json` (antes `src/inbox.js`). El procedimiento está en `CLAUDE.md`.
- La bandeja ahora también puede **quitar** actividades o citas, **cambiar fechas** y **cambiar de frente**. Todo queda en la bitácora con autor `claude`.
- Nueva actividad (cv21): crear la compañía propia (liviana, de bajo costo, con representación legal), frente Negocio propio, meta 2 oct 2026. El tipo de sociedad y el costo quedan [POR CONFIRMAR].
