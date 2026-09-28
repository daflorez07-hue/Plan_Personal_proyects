# Trazabilidad de requisitos · versión 1 (26 sep 2026)

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
| 4 | 3 sí → verde; 2 sí → "cumplimiento parcial (2 de 3)" | Cumple | lógica + e2e |
| 5 | + crea movimiento fechado y la gráfica lo refleja | Cumple | e2e |
| 6 | Tercer frente en Construir muestra la advertencia RN-03 | Cumple | lógica + e2e |
| 7 | API rechaza sin token y permite con token | **No aplica en esta arquitectura** | El acceso lo controla la plataforma: escribir exige ser dueño o editor (verificado: un colaborador sin edición recibe rechazo) |
| 8 | 360 px sin desplazamiento horizontal | Cumple | e2e recorre las 12 vistas |
| 9 | Sin secretos en el repositorio | Cumple | búsqueda antes del commit; no hay `.env` porque no hay credenciales |

## Requisitos funcionales
RF-01 a RF-12: implementados. RF-13 y RF-14: pendientes (ver decisión de arquitectura).

## Limitaciones conocidas del visor
- **Micrófono:** el visor de artefactos puede bloquear el micrófono de la página. La app lo intenta y, si no hay acceso, indica usar el dictado del teclado del celular.
- **Avisos con la app cerrada:** una página no puede enviar notificaciones push. El aviso con la app cerrada lo hace el calendario del celular a partir del `.ics` con alarma o del evento creado en Google Calendar u Outlook.
- **Descargas:** el visor no admite `.ics` como descarga directa; se entrega dentro de un `.zip`.
- **Google Calendar:** el enlace crea el evento con el aviso predeterminado de tu calendario; el `.ics` sí lleva el aviso exacto que elegiste.

## Decisiones que necesito de David
1. `[DATO REQUERIDO]` Cifra de "más ventas" y esquema de la deuda (criterios medibles), antes del 11 ene 2027. Se escriben en Puntos de control.
2. `[POR CONFIRMAR]` Día del comité financiero mensual (4 horas) para la semana tipo.
3. `[SUPUESTO DECLARADO]` Fechas de inicio y fin de cada etapa, duración del gimnasio (1 h), del comité de socios (1 h) y horario del bloque de familia del sábado. Editables en Ajustes y Semana tipo.
4. `[DATO REQUERIDO]` Criterio de salida de ZONAL y de Berry Lab.
5. Si se quiere RF-13 (API con token para Emilia fuera de Claude): aprobar el despliegue en Vercel + Supabase y escribir las credenciales en las variables de entorno.
