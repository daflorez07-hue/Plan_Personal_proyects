# Derrotero · cómo operar la app desde el chat

David pide por chat agregar, cambiar o quitar cosas del plan. Eso **no** se hace tocando el código:
se agrega una entrada al final de `data/bandeja.json` y se publica. La app la aplica una sola vez
al abrirse (queda en `config.main.inboxApplied` y en la bitácora con autor `claude`).

## Tipos de entrada (id siguiente: `cvNN`, nunca reutilizar uno)
- Actividad nueva: `{"id","title","front","owner":"Tú","due":"AAAA-MM-DD"|"" ,"note"}`. `front` debe ser un frente existente (IKM, LinkedIn, Negocio propio, Empleo, Activos, Finca, Laboratorio).
- Cambio: `{"id","kind":"patch","task", "status"?, "reopen"?, "title"+"titleFrom"?, "due"(+"dueFrom")?, "front"?, "noteAppend"?}`. No pisa lo que David ya cambió: el título solo si sigue igual a `titleFrom`; una actividad hecha solo se reabre con `"reopen": true`.
- Quitar: `{"id","kind":"remove","task"}` o `{"id","kind":"remove","agenda"}`.
- Citas: `{"id","kind":"agenda","summary","items":[{"id","title","date","time","durationMin","remindMin","front","note"}]}`.
- Laboratorio: `{"id","kind":"lab","lab","name"+"nameFrom"?, "exitCriterion"+"replaceFrom"?}`.

## Reglas
- No inventar datos: lo que falte va como `[DATO REQUERIDO]`, `[POR CONFIRMAR]` o `[SUPUESTO DECLARADO]` en la nota.
- Nada sensible de terceros (teléfonos personales, documentos de identidad) y ningún secreto.
- Antes de publicar: `npm test` (valida la bandeja) y, si cambió el conteo de actividades, ajustar `test/e2e.js` y `test/e2e-vercel.js`.
- Publicar: rama de trabajo → PR → merge a `main`; Vercel despliega solo. David autorizó publicar así los cambios de datos que pide por chat.
