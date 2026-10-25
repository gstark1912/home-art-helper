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

## Qué se puede paralelizar

- **Ahora:** T001 y T002; no comparten archivos. T002 puede documentar la instalación, pero la conexión final al servidor espera T005.
- **Tras completar T001:** T003 y T004, con responsables diferentes. T003 es dueño de la solución .NET; T004 es dueño de `package.json` y el lockfile del frontend.
- **Luego:** T005 integra ambos. Si surge un defecto que exige editar código reservado, asignar ese cambio al responsable correspondiente antes de trabajar simultáneamente.

Mensajes temporales, música simulada y validación Android final siguen en el diseño, pero sus tareas detalladas se crearán después de verificar la primera demostración. No están autorizadas como trabajo paralelo sin definición de alcance.

## Cómo tomar una tarea

Alcanza con decir **«continuá con la próxima tarea»**. El agente aplica el [protocolo de selección](../.kiro/steering/task-selection.md): reserva bajo un bloqueo breve, registra `in_progress` y responsable antes de editar, y ejecuta una tarea. También se puede asignar un ID explícito.

El protocolo busca trabajo independiente aunque haya tareas bloqueadas y prioriza revisar entregas ajenas para liberar dependencias. Si no hay trabajo elegible, informa IDs y causas y termina; no espera a que otro LLM finalice ni toma trabajo reservado.

`tasks/.selection-lock/` es un bloqueo temporal local ignorado por Git. Con clones separados se requieren asignaciones explícitas o un tablero común.

La plantilla incluye criterios de aceptación, límites de archivos y entrega para que otro LLM pueda continuar sin reconstruir la conversación.
