# Delegar una tarea a otro LLM

Esta guía se puede pegar en Kiro, Codex u otra herramienta. Las reglas vigentes están en `.kiro/steering/`; leerlas antes de actuar.

## Prompt de asignación

Para selección automática basta con:

```text
En C:\Users\Germa\source\repos\home-art-helper, continuá con la próxima tarea.
Leé AGENTS.md y seguí .kiro/steering/task-selection.md.
```

El agente selecciona, reserva y ejecuta una tarea o revisión. Si ninguna es elegible, informa por qué y termina. Para asignar una tarea concreta:

```text
Trabajá en Home&Art Helper, carpeta C:\Users\Germa\source\repos\home-art-helper.
Tu tarea asignada es T002 (reemplazar por el ID acordado).

Leé README.md, todos los Markdown de .kiro/steering/, tasks/README.md,
el archivo de tu tarea y sus entradas. No modifiques nada fuera del alcance
reservado. Revisá el estado y responsable antes de tomarla; si ya está activa
por otro agente, avisame y detenete.

Usá el bloqueo de .kiro/steering/task-selection.md para registrar
tu identidad y estado in_progress antes de editar. Seguí los contratos
aprobados. No cambies de rama ni reviertas cambios ajenos en el checkout compartido.
Si falta una dependencia, dejá blocked con la causa concreta.

Al terminar dejá review, con archivos, evidencia de verificación, limitaciones,
decisiones y el siguiente paso en la propia tarea. No marques done sin revisión
de otro agente o mía. Avisame qué tareas quedan habilitadas para paralelizar.
```

## Revisión por otro agente

Reservar la revisión según `task-selection.md`. Revisar criterios de aceptación contra diff y evidencia, ejecutar checks pertinentes y registrar identidad y resultados. Si está conforme, marcar `done`; si falla, dejar hallazgos y devolver a `ready` para corrección. Actualizar estados bajo el bloqueo breve y liberar el revisor activo.

## Entrega entre checkouts

Informar rama, commit base y commits propios. El responsable de integración incorpora los cambios y vuelve a verificar. En un checkout compartido no hacer cherry-pick de cambios que ya están presentes. La selección automática usa el bloqueo local de `task-selection.md`; entre clones separados se requieren asignaciones explícitas o un tablero común.
