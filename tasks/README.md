# Repositorio de tareas

Una tarea por archivo `Txxx-descripcion.md`. El estado y responsable se consultan en el archivo, no en este índice. Usar `_template.md` para nuevas tareas y respetar `.kiro/steering/collaboration.md`.

## Índice y dependencias

| ID | Entrega | Depende de | Archivos principales |
|---|---|---|---|
| [T001](T001-display-contracts.md) | Contratos HTTP/SignalR y decisiones de autenticación | Diseño aprobado | `docs/contracts/display-protocol.md` |
| [T002](T002-android-emulator.md) | Guía reproducible de Android Emulator | Ninguna para instalación | `docs/runbooks/android-emulator.md` |
| [T003](T003-server-foundation.md) | Servidor autenticado, estado, API y SignalR | T001 | Servidor, solución, pruebas backend |
| [T004](T004-client-foundation.md) | Panel separado y display Canvas | T001 | Aplicación Vue y pruebas frontend |
| [T005](T005-first-demo.md) | Primera demostración integrada | T003 y T004 | Guía de ejecución, pruebas de integración, README |
| [T006](T006-temporary-messages.md) | Mensajes temporales en el display | T005 | Backend + frontend de mensajes |
| [T007](T007-simulated-music.md) | Música simulada y disco giratorio | T005 | Backend + frontend de música |
| [T008](T008-android-validation.md) | Validación de extremo a extremo en Android Emulator | T005 | Runbooks de Android y desarrollo local |

## Qué se puede paralelizar

- **Ahora:** T001 y T002; no comparten archivos. T002 puede documentar la instalación, pero la conexión final al servidor espera T005.
- **Tras completar T001:** T003 y T004, con responsables diferentes. T003 es dueño de la solución .NET; T004 es dueño de `package.json` y el lockfile del frontend.
- **Tras completar T005:** T006, T007 y T008 pueden tomarse en paralelo, con una salvedad de alcance: T006 y T007 tocan **los mismos subárboles** (`src/Ambient.Server/**`, `tests/Ambient.Server.Tests/**` y `src/ambient-client/**`). Pueden avanzar en paralelo sólo si se reparten subárboles sin solaparse (p. ej. un agente el backend de T006 mientras otro el frontend de T007) y lo registran en cada tarea; de lo contrario, serializarlas. T008 es documental (runbooks) y requiere coordinación con el usuario para el emulador; no comparte archivos con T006/T007 y puede correr en paralelo con ellas.
- Si surge un defecto que exige editar código reservado, asignar ese cambio al responsable correspondiente antes de trabajar simultáneamente.

## Cómo tomar una tarea

Alcanza con decir **«continuá con la próxima tarea»**. El agente aplica el [protocolo de selección](../.kiro/steering/task-selection.md): reserva bajo un bloqueo breve, registra `in_progress` y responsable antes de editar, y ejecuta una tarea. También se puede asignar un ID explícito.

El protocolo busca trabajo independiente aunque haya tareas bloqueadas y prioriza revisar entregas ajenas para liberar dependencias. Si no hay trabajo elegible, informa IDs y causas y termina; no espera a que otro LLM finalice ni toma trabajo reservado.

`tasks/.selection-lock/` es un bloqueo temporal local ignorado por Git. Con clones separados se requieren asignaciones explícitas o un tablero común.

La plantilla incluye criterios de aceptación, límites de archivos y entrega para que otro LLM pueda continuar sin reconstruir la conversación.
