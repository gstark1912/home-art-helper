---
inclusion: always
---

# Continuar con la próxima tarea

## Disparador

Ante «continuá con la próxima tarea», «seguí con lo pendiente» o equivalente, seleccionar y ejecutar **una** tarea o revisión mediante este protocolo. No pedir un ID si se puede determinar automáticamente. Una asignación explícita de ID limita la selección a esa tarea, pero no permite saltarse reservas ni dependencias.

Leer todas las reglas, el diseño y `tasks/T[0-9]*-*.md`. `tasks/README.md` es un índice; cada archivo de tarea es la fuente vigente de estado. No inferir estado de conversaciones previas o casillas marcadas.

## Bloqueo breve de selección

En este checkout compartido, antes de seleccionar/reservar o cambiar estado, responsable o revisor, crear exclusivamente `tasks/.selection-lock/`. La operación debe **fallar si ya existe**. No sobrescribir ni usar una función que acepte un directorio existente como éxito.

Ejemplos: PowerShell `New-Item -ItemType Directory -Path tasks/.selection-lock -ErrorAction Stop` sin `-Force`; Python `os.mkdir('tasks/.selection-lock')`. Si existe, no se adquirió el bloqueo. Registrar dentro `owner.txt` con herramienta, ID único de sesión y fecha ISO con zona horaria, sin secretos.

El bloqueo sólo cubre releer estados, seleccionar, guardar y comprobar la reserva. **Liberarlo antes de implementar o revisar**: el archivo de tarea es la reserva duradera. En un `finally`, eliminar únicamente el `owner.txt` propio y luego el directorio vacío creado por esta sesión; no usar borrado recursivo ni tocar bloqueos ajenos.

Si está ocupado, informar «Otro agente está actualizando la lista de tareas; no tomé ninguna tarea» y terminar, sin esperar en bucle. Si parece huérfano, pedir al usuario confirmación para liberarlo; el tiempo transcurrido no prueba abandono.

Este mecanismo sólo coordina agentes que comparten el mismo checkout. En clones separados, acordar asignaciones explícitas o un tablero compartido antes de paralelizar.

## Selección dentro del bloqueo

1. Releer todas las tareas después de adquirir el bloqueo. Si faltan dependencias o hay datos contradictorios que impidan decidir, informar el problema concreto y terminar sin improvisar.
2. Si esta misma sesión ya tiene una tarea `in_progress`, continuarla. No tomar la de una sesión anterior aunque use la misma herramienta.
3. Rehabilitar tareas `blocked` sin responsable activo sólo cuando todas sus dependencias estén `done` y el bloqueo registrado se limite a esas dependencias ya resueltas. Guardar `ready`, bloqueo `ninguno` y fecha. No liberar bloqueos por instalación, decisiones humanas u otros impedimentos.
4. Priorizar la revisión de la tarea `review` con ID numérico menor, cuyo autor sea otro agente y sin revisor activo. Registrar `Revisor activo`, fecha y alcance reservado; mantener estado `review` y autor. La revisión permite leer código; no autoriza editar archivos reservados por otra tarea.
5. Si no hay revisión elegible, elegir la tarea `ready` con ID numérico menor, sin responsable activo, con dependencias `done` y sin superposición con archivos reservados por tareas `in_progress` o revisiones activas. Si una está impedida, buscar otra independiente. Leer toda la tarea antes de reservar.
6. Guardar `Estado: in_progress`, `Responsable: <herramienta>/<ID único de sesión>`, fecha ISO con zona horaria y `Bloqueo: ninguno`. El alcance de archivos de la tarea debe estar definido y se considera reservado; precisarlo ahora si hace falta. Guardar y releer para comprobar la reserva antes de liberar el bloqueo. No editar producto antes de este registro.
7. Si ninguna es elegible, informar IDs y causas: dependencia pendiente, responsable activo, revisión propia pendiente o conflicto de archivos. Si todas están `done`, informar que no quedan tareas pendientes. Liberar el bloqueo y **terminar**; no esperar, sondear a otro agente, crear trabajo innecesario ni apropiarse de una tarea activa.

## Ejecución y entrega

Fuera del bloqueo, anunciar ID y objetivo, ejecutar y verificar según `collaboration.md`. Antes de cambiar estado para entregar, adquirir de nuevo el bloqueo y releer. Si está ocupado, conservar la reserva y reportar que falta publicar la entrega; no afirmar que el estado cambió.

- Implementación terminada: dejar `review`, conservar autor, registrar evidencia, archivos, decisiones y pendientes; `Revisor activo: ninguno`.
- Revisión aprobada: dejar `done`, registrar identidad y resultado y quitar revisor activo. Rehabilitar dependencias cuyo único impedimento desapareció, según las reglas anteriores. Completar el cierre con commit de la entrega aprobada en `main` y push a `origin/main`, según `collaboration.md`; comprobar el resultado e informar el hash y cualquier impedimento de publicación. No usar worktrees ni ramas de trabajo.
- Revisión rechazada: registrar hallazgos, quitar revisor activo y dejar `ready` sin responsable activo para que se pueda reservar la corrección. Conservar autoría previa en Entrega.
- Impedimento durante ejecución: guardar `blocked`, causa y entrega parcial; liberar responsable activo conservando identidad en Entrega. No desbloquear mientras persista esa causa.

Actualizar también `Actualizado` en cada transición. Al terminar, informar verificación y qué IDs se pueden paralelizar. No encadenar tareas automáticamente salvo pedido explícito de procesar varias. No presentar revisión propia como independiente.
