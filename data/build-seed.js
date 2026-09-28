// Genera data/seed.json a partir de la sección 6 del documento de requisitos.
const fs = require('fs');
const T = [
 ['t01','inmediato','Definir condiciones y fechas de decisión con IKM: comisiones, más ventas y deuda cubierta · revisión 11–15 ene y 22–31 mar','IKM','Tú','2026-09-25','hecha','Decidido el 25 sep 2026.'],
 ['t02','inmediato','Leer acuerdo de socios y contrato con IKM (no competencia y conflicto de interés)','IKM','Tú','2026-09-25','hecha','Revisado: sin restricciones que afecten el plan.'],
 ['t03','inmediato','Definir los nichos de la suscripción','Negocio propio','Tú + esposa','2026-09-25','hecha',''],
 ['t04','inmediato','Cambiar el titular de LinkedIn por uno honesto (sin cargo de Chief Data Officer)','LinkedIn','Tú','2026-10-02','pendiente',''],
 ['t05','inmediato','Bloquear la semana tipo en el calendario (horas creativas martes y jueves)','LinkedIn','Tú','2026-10-02','pendiente',''],
 ['t06','inmediato','Pedir a Emilia la lista de 30 headhunters y 40 decisores','Empleo','Tú + Emilia','2026-10-02','pendiente',''],
 ['t07','inmediato','Agendar con Cristian la conversación del acuerdo de implementaciones','Negocio propio','Tú','2026-10-02','pendiente',''],
 ['t08','inmediato','Fijar con tu esposa la fecha en que sale a vender','Negocio propio','Tú + esposa','2026-10-02','pendiente',''],
 ['t09','inmediato','Elegir el nombre de la empresa y verificar RUES, dominio .co y marca en la SIC','Negocio propio','Tú','2026-10-09','pendiente',''],
 ['t10','inmediato','Completar y enviar la oferta a Language Solutions','Negocio propio','Tú','2026-10-09','pendiente','Completar los datos requeridos del borrador.'],
 ['t11','octubre','Firmar acuerdo escrito con Cristian: alcance, pago por proyecto y salida','Negocio propio','Tú + Cristian','2026-10-16','pendiente',''],
 ['t12','octubre','Armar la oferta de clientes fundadores por nicho','Negocio propio','Tú + esposa','2026-10-16','pendiente','Precio congelado, pago anticipado, permiso para medir resultados.'],
 ['t13','octubre','Decidir con contador la titularidad y régimen de la SAS de servicios y constituirla','Negocio propio','Tú + contador','2026-10-31','pendiente',''],
 ['t14','octubre','Empezar el portafolio de negocios originados (solo información autorizada)','Empleo','Tú + Emilia','2026-10-31','pendiente',''],
 ['t15','octubre','Optimizar perfil de Instagram y arrancar 2 piezas por semana','Negocio propio','Tú','2026-10-31','pendiente',''],
 ['t16','novdic','5 clientes fundadores pagando','Negocio propio','Esposa','2026-12-15','pendiente',''],
 ['t17','novdic','2 conversaciones con headhunters para conocer tu valor de mercado','Empleo','Tú','2026-11-30','pendiente',''],
 ['t18','novdic','10 conversaciones de ticket alto fuera de energía','Negocio propio','Tú','2026-12-15','pendiente',''],
 ['t19','novdic','Contrato de transmisión de datos y servidor en producción','Negocio propio','Tú + abogado','2026-11-30','pendiente',''],
 ['t20','novdic','Finca: predio elegido o decisión de esperar','Finca','Tú + familia','2026-12-15','pendiente','Un sábado al mes en campo: San Francisco, Supatá, Silvania.'],
 ['t21','enemar','Revisión 1 con IKM: comisiones, ventas y deuda','IKM','Tú','2027-01-15','pendiente',''],
 ['t22','enemar','10 suscriptores activos','Negocio propio','Esposa','2027-03-31','pendiente',''],
 ['t23','enemar','1 proyecto de ticket alto cerrado y ejecutándose','Negocio propio','Tú vendes · Cristian ejecuta','2027-03-31','pendiente',''],
 ['t24','enemar','Constituir la SAS inmobiliaria con Cristian antes de la entrega del apartamento','Activos','Tú + Cristian','2027-03-31','pendiente',''],
 ['t25','enemar','ZONAL: versión mínima probada con corredores','Laboratorio','Tú','2027-03-31','pendiente',''],
 ['t26','enemar','Decisión final sobre IKM (fecha límite)','IKM','Tú + esposa','2027-03-31','pendiente','Con las tres condiciones cumplidas te quedas; si no, plan de salida.'],
 ['t27','abrjun','Ejecutar la decisión: empleo, consultor asociado o seguir en IKM','Empleo','Tú','2027-04-30','pendiente','Si hay oferta: declarar la SAS y cerrar ordenadamente con IKM.'],
 ['t28','abrjun','Primera operación del apartamento nuevo en rentas cortas','Activos','Cristian','2027-06-30','pendiente',''],
 ['t29','abrjun','Berry Lab: 4 fines de semana de preventa','Laboratorio','Tú','2027-06-30','pendiente','Cocina compartida por horas, 3 productos, concepto sanitario.'],
];
const order = {};
const tasks = {};
for (const [id, phase, title, front, owner, due, status, note] of T) {
  order[phase] = (order[phase] || 0) + 1;
  tasks[id] = { id, title, phase, order: order[phase], front, owner, due, status, note, blockCause: '',
    doneAt: status === 'hecha' ? due : '', version: 1, updatedAt: 0 };
}
const crit = (label) => ({ label, value: 'pendiente', measurable: '', evidence: '', link: '' });
const criteria = () => ({ comisiones: crit('Me pagan mis comisiones'), ventas: crit('IKM vende más'), deuda: crit('Se cubre la deuda de IKM conmigo') });
const seed = {
  config: {
    id: 'main',
    planStart: '2026-09-25',
    planEnd: '2027-06-30',
    phases: {
      inmediato: { id: 'inmediato', title: 'Inmediato · antes del 2 de octubre', start: '2026-09-25', end: '2026-10-09', order: 1 },
      octubre: { id: 'octubre', title: 'Octubre 2026', start: '2026-10-01', end: '2026-10-31', order: 2 },
      novdic: { id: 'novdic', title: 'Noviembre – diciembre 2026', start: '2026-11-01', end: '2026-12-31', order: 3 },
      enemar: { id: 'enemar', title: 'Enero – marzo 2027', start: '2027-01-01', end: '2027-03-31', order: 4 },
      abrjun: { id: 'abrjun', title: 'Abril – junio 2027', start: '2027-04-01', end: '2027-06-30', order: 5 }
    },
    phaseDatesNote: 'Supuesto declarado: las fechas de inicio y fin de cada etapa se dedujeron de su título y de las fechas de sus actividades. Ajústalas aquí.',
    fronts: {
      ikm: { id: 'ikm', name: 'IKM', mode: 'operar', order: 1, scope: 'Trabajo actual, puntos de control y decisión' },
      linkedin: { id: 'linkedin', name: 'LinkedIn', mode: 'construir', order: 2, scope: 'Marca de líder de datos e IA en energía: 2 piezas y 20 comentarios por semana' },
      negocio: { id: 'negocio', name: 'Negocio propio', mode: 'construir', order: 3, scope: 'Suscripción "Analógico a Digital" y proyectos de ticket alto con IA' },
      empleo: { id: 'empleo', name: 'Empleo', mode: 'explorar', order: 4, scope: 'Headhunters y decisores en operadoras y tecnología para energía' },
      activos: { id: 'activos', name: 'Activos', mode: 'operar', order: 5, scope: 'Apartamentos con Cristian y portafolio de acciones' },
      finca: { id: 'finca', name: 'Finca', mode: 'explorar', order: 6, scope: 'ALTAVERDE: selección de predio y validaciones' },
      laboratorio: { id: 'laboratorio', name: 'Laboratorio', mode: 'laboratorio', order: 7, scope: 'Un proyecto de gusto por trimestre' }
    },
    kpis: [
      { key: 'fundadores', label: 'Clientes fundadores pagando', target: 5, due: '2026-12-31', order: 1 },
      { key: 'suscriptores', label: 'Suscriptores activos', target: 10, due: '2027-03-31', order: 2 },
      { key: 'conversaciones', label: 'Conversaciones de ticket alto', target: 10, due: '2026-12-31', order: 3 },
      { key: 'ticketAlto', label: 'Proyectos de ticket alto cerrados', target: 1, due: '2027-03-31', order: 4 },
      { key: 'headhunters', label: 'Conversaciones con headhunters', target: 2, due: '2026-11-30', order: 5 },
      { key: 'publicaciones', label: 'Piezas publicadas en LinkedIn', target: 48, due: '2027-03-31', order: 6 }
    ],
    modeReview: { note: '', updatedAt: 0 }
  },
  tasks,
  kpis: { values: { fundadores: 0, suscriptores: 0, conversaciones: 0, ticketAlto: 0, headhunters: 0, publicaciones: 0 } },
  checkpoints: {
    'ene-2027': { id: 'ene-2027', title: 'Revisión 1 · segunda semana de enero', windowStart: '2027-01-11', windowEnd: '2027-01-15', order: 1, criteria: criteria(), note: '', version: 1 },
    'mar-2027': { id: 'mar-2027', title: 'Decisión · última semana de marzo', windowStart: '2027-03-22', windowEnd: '2027-03-31', order: 2, criteria: criteria(), note: '', version: 1 }
  },
  habits: {
    h1: { id: 'h1', title: 'Publicar en LinkedIn', freq: 'semanal', target: 2, days: [3, 5], when: 'Miércoles y viernes, mediodía', front: 'LinkedIn', order: 1 },
    h2: { id: 'h2', title: 'Comentarios en LinkedIn', freq: 'diario', target: 1, days: [1, 2, 3, 4, 5], when: 'Lunes a viernes, 12:00–12:20', front: 'LinkedIn', order: 2 },
    h3: { id: 'h3', title: 'Hora creativa', freq: 'semanal', target: 2, days: [2, 4], when: 'Martes y jueves, primera hora', front: 'Negocio propio', order: 3 },
    h4: { id: 'h4', title: 'Revisión semanal', freq: 'semanal', target: 1, days: [5], when: 'Viernes 2:00 p. m., 45 min', front: '', order: 4 },
    h5: { id: 'h5', title: 'Revisión de activos con Cristian', freq: 'quincenal', target: 1, days: [], when: 'Primer día hábil tras el 15 y el 30', front: 'Activos', order: 5 },
    h6: { id: 'h6', title: 'Revaluación del portafolio', freq: 'quincenal', target: 1, days: [5], when: 'Viernes en la tarde', front: 'Activos', order: 6 },
    h7: { id: 'h7', title: 'Visita a predios de la finca', freq: 'mensual', target: 1, days: [6], when: 'Primer sábado del mes', front: 'Finca', order: 7 }
  },
  blocks: {},
  lab: {
    zonal: { id: 'zonal', name: 'ZONAL', description: 'App de carrera con conquista territorial', quarter: '2027-T1', exitCriterion: '', decision: '', decisionNote: '', decidedAt: '' },
    berry: { id: 'berry', name: 'Berry Lab', description: 'Postres en cocina oculta', quarter: '2027-T2', exitCriterion: '', decision: '', decisionNote: '', decidedAt: '' }
  }
};
// Semana tipo: 0=domingo … 6=sábado
let n = 0;
const B = (day, start, end, title, cat, note = '') => { n++; seed.blocks['b' + String(n).padStart(2, '0')] = { id: 'b' + String(n).padStart(2, '0'), day, start, end, title, cat, note }; };
for (const d of [1, 2, 3, 4, 5, 6, 0]) B(d, '05:00', '06:00', 'Gimnasio', 'salud', 'Supuesto declarado: 1 hora.');
for (const d of [1, 2, 3, 4, 5]) { B(d, '12:00', '14:00', 'Almuerzo · ventana libre', 'libre'); }
B(1, '08:00', '09:00', 'Comité de nuevos negocios', 'ikm');
B(1, '09:00', '10:00', 'Comité operativo', 'ikm');
B(1, '11:00', '12:00', 'Comité de socios', 'ikm', 'Supuesto declarado: duración de 1 hora.');
B(3, '08:00', '10:00', 'Comité directivo', 'ikm');
B(1, '17:00', '18:00', 'Ticket alto', 'personal');
B(2, '17:00', '18:00', 'Reunión de suscripción con tu esposa', 'personal');
B(3, '17:00', '18:00', 'Llamada con Cristian', 'personal');
B(4, '17:00', '18:00', 'Ticket alto y headhunters', 'personal');
B(5, '14:00', '14:45', 'Revisión semanal', 'personal');
B(5, '15:00', '17:00', 'Negocio propio', 'personal');
B(6, '09:00', '18:00', 'Familia', 'familia', 'Supuesto declarado: horario del bloque.');
fs.writeFileSync(__dirname + '/seed.json', JSON.stringify(seed, null, 2) + '\n');
console.log('tasks', Object.keys(tasks).length, 'blocks', n);
