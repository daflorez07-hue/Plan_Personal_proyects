/* Derrotero · pendientes registrados por Claude a partir de las conversaciones con David.
 * Se agregan una sola vez al plan (config.main.inboxApplied guarda cuáles ya entraron),
 * así que si David borra uno, no vuelve a aparecer. Sin datos inventados: lo que falta
 * se marca como [DATO REQUERIDO] o [POR CONFIRMAR]. */
(function (root) {
  'use strict';
  var FUENTE = 'Registrado por Claude a partir de la conversación del 28 sep 2026.';
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
      note: 'El enlace secreto del calendario quedó en la conversación con Claude. Si se vuelve a publicar, pásale el enlace nuevo a Claude para actualizar Vercel. ' + FUENTE }
  ];
})(window);
