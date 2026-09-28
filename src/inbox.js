/* Derrotero · pendientes registrados por Claude a partir de las conversaciones con David.
 * Cada entrada se aplica una sola vez (config.main.inboxApplied guarda cuáles ya entraron),
 * así que si David borra o cambia algo, no se repite. Tipos: task (actividad nueva),
 * patch (estado, nota o título de una actividad; el título solo si no lo han cambiado), agenda (citas)
 * y lab (nombre y criterio de salida; solo reemplaza lo que Claude mismo había propuesto o lo vacío). Sin datos inventados: lo que falta
 * se marca como [DATO REQUERIDO] o [POR CONFIRMAR]. */
(function (root) {
  'use strict';
  var FUENTE = 'Registrado por Claude a partir de la conversación del 28 sep 2026.';
  var PROPUESTA = 'Propuesta de Claude (ajústala): ';
  var ZONAL_CRIT = 'al 31 mar 2027 → Se vuelve negocio si 30 corredores la usan 2 semanas seguidas y 10 dicen que pagarían; Sigue un trimestre más con 10 a 29 corredores activos; Se pausa con menos de 10 o si no hay versión mínima al 15 mar.';
  var POSTRES_CRIT = 'al cierre de los 4 fines de semana de preventa → Se vuelve negocio con 60 pedidos pagados, 30 % de clientes que repiten y margen bruto de 50 % o más (después de la cocina por horas); Sigue un trimestre con 25 a 59 pedidos o margen entre 35 y 50 %; Se pausa con menos de 25 pedidos o margen bajo 35 %.';
  var NOMBRE_TAREA = 'Elegir el nombre nuevo del laboratorio de postres ("Berry Lab" ya existe) y verificarlo en la SIC, dominio .co e Instagram';
  root.DERROTERO_INBOX = [
    { id: 'cv01', title: 'Definir la cifra de "más ventas" y el esquema de la deuda (criterios medibles de la revisión con IKM)', front: 'IKM', owner: 'Tú', due: '2027-01-11',
      note: '[DATO REQUERIDO] Sin estos números la Revisión 1 con IKM (15 ene) no se puede evaluar. ' + FUENTE },
    { id: 'cv02', title: 'Confirmar el día del comité financiero mensual (4 horas) y bloquearlo en la semana tipo', front: 'IKM', owner: 'Tú', due: '',
      note: '[POR CONFIRMAR] Día y hora del comité. ' + FUENTE },
    { id: 'cv03', title: 'Escribir el criterio de salida de ZONAL', front: 'Laboratorio', owner: 'Tú', due: '',
      note: '[DATO REQUERIDO] Qué tiene que pasar para decidir si sigue, se pausa o se vuelve negocio. Se escribe también en Laboratorio. ' + FUENTE },
    { id: 'cv04', title: 'Escribir el criterio de salida de Berry Lab', front: 'Laboratorio', owner: 'Tú', due: '',
      note: '[DATO REQUERIDO] Qué tiene que pasar para decidir si sigue, se pausa o se vuelve negocio. Se escribe también en Laboratorio. ' + FUENTE },
    { id: 'cv05', title: 'Revisar si publicar el calendario de Outlook de IKM encaja con la política de seguridad; si no, dejar de publicarlo y generar un enlace nuevo', front: 'IKM', owner: 'Tú', due: '',
      note: 'El enlace secreto del calendario quedó en la conversación con Claude. Si se vuelve a publicar, pásale el enlace nuevo a Claude para actualizar Vercel. ' + FUENTE },
    // ── 28 sep 2026, segunda parte: respuestas de David ──
    { id: 'cv06', kind: 'patch', task: 'cv01', status: 'en curso',
      noteAppend: '28 sep: cifra de "más ventas" ≈ $1.000 millones. [POR CONFIRMAR] En qué periodo se mide y si son ventas firmadas o facturadas. Falta el esquema de la deuda [DATO REQUERIDO].' },
    { id: 'cv07', kind: 'patch', task: 'cv02', status: 'hecha',
      noteAppend: '28 sep: segundo martes de cada mes, 9:00 a. m. – 1:00 p. m. Quedó en la agenda de oct 2026 a jun 2027 con aviso un día antes.' },
    { id: 'cv08', kind: 'agenda', summary: 'Comité financiero IKM: segundo martes de cada mes, 9:00 a. m. – 1:00 p. m. (9 fechas en la agenda)',
      items: ['2026-10-13', '2026-11-10', '2026-12-08', '2027-01-12', '2027-02-09', '2027-03-09', '2027-04-13', '2027-05-11', '2027-06-08'].map(function (d) {
        return { id: 'cf-' + d, title: 'Comité financiero IKM', date: d, time: '09:00', durationMin: 240, remindMin: 1440, front: 'IKM', note: 'Segundo martes de cada mes, 9:00 a. m. – 1:00 p. m. ' + FUENTE };
      }) },
    { id: 'cv09', kind: 'lab', lab: 'zonal',
      exitCriterion: PROPUESTA + ZONAL_CRIT },
    { id: 'cv10', kind: 'patch', task: 'cv03', status: 'en curso',
      noteAppend: '28 sep: David pidió ayuda. Claude dejó una propuesta de criterio en Laboratorio → ZONAL. Revísala y ajusta los números.' },
    { id: 'cv11', kind: 'lab', lab: 'berry',
      exitCriterion: PROPUESTA + POSTRES_CRIT },
    { id: 'cv12', kind: 'patch', task: 'cv04', status: 'en curso',
      noteAppend: '28 sep: David pidió ayuda. Claude dejó una propuesta de criterio en Laboratorio. El nombre "Berry Lab" ya existe: ver la actividad del nombre nuevo.' },
    { id: 'cv13', title: NOMBRE_TAREA, front: 'Laboratorio', owner: 'Tú', due: '2027-03-15',
      note: 'Opciones de Claude, en el estilo de ZONAL: MORALEJA (mora + moraleja; recomendada: se recuerda y cuenta una historia), BAYA (berry en español, corta y directa), AGRIDULCE (el sabor de los frutos rojos), OCULTA (viene de cocina oculta; exclusiva, por preventa). [SUPUESTO DECLARADO] Fecha: dos semanas antes de que empiece su trimestre (abr 2027). ' + FUENTE },
    { id: 'cv14', kind: 'patch', task: 'cv05',
      noteAppend: '28 sep: David decide seguir con el calendario de IKM mientras confirma la política.' }
,
    // ── 28 sep 2026, tercera parte: David elige MORALEJA y aprueba los criterios ──
    { id: 'cv15', kind: 'lab', lab: 'berry', nameFrom: 'Berry Lab', name: 'MORALEJA', replaceFrom: PROPUESTA + POSTRES_CRIT, exitCriterion: POSTRES_CRIT },
    { id: 'cv16', kind: 'lab', lab: 'zonal', replaceFrom: PROPUESTA + ZONAL_CRIT, exitCriterion: ZONAL_CRIT },
    { id: 'cv17', kind: 'patch', task: 'cv03', status: 'hecha', noteAppend: '28 sep: David aprueba el criterio de salida de ZONAL.' },
    { id: 'cv18', kind: 'patch', task: 'cv04', status: 'hecha', titleFrom: 'Escribir el criterio de salida de Berry Lab', title: 'Escribir el criterio de salida de MORALEJA',
      noteAppend: '28 sep: David aprueba el criterio de salida y elige el nombre MORALEJA.' },
    { id: 'cv19', kind: 'patch', task: 'cv13', status: 'en curso', titleFrom: NOMBRE_TAREA, title: 'Verificar que MORALEJA esté libre en la SIC, dominio .co e Instagram',
      noteAppend: '28 sep: David elige MORALEJA. Falta verificar que esté libre antes de usarlo.' },
    { id: 'cv20', kind: 'patch', task: 't29', titleFrom: 'Berry Lab: 4 fines de semana de preventa', title: 'MORALEJA: 4 fines de semana de preventa' }
  ];
})(window);
