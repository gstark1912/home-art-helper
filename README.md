# Home&Art Helper

Cuadro digital ambiental doméstico: una tablet Android muestra contenido visual y un servidor local lo controla. El panel de administración se abre desde una PC o celular, separado de la tablet.

## Estado actual

Proyecto en preparación. Existe un diseño aprobado y una base de colaboración; todavía no hay aplicación ejecutable ni comandos de arranque. No se requiere comprar la tablet para comenzar: el display se validará primero en navegador y Android Emulator.

## Arquitectura prevista

- **Ambient Server:** ASP.NET Core .NET 10, API HTTP, SignalR y estado en memoria.
- **Ambient Client:** Vue 3, Vite, TypeScript y Canvas 2D.
- **`/display`:** contenido visual en la tablet, sin controles.
- **`/control`:** panel remoto en otra PC o celular.
- **Android Emulator:** tablet virtual que abre el mismo display, sin una implementación alternativa.

El servidor servirá el frontend compilado. Durante desarrollo, Vite usará un proxy. Sin cloud, base de datos, Spotify real, IA real ni control físico de energía en el MVP.

La primera prueba será cambiar una animación desde el panel y verla actualizarse inmediatamente en otro navegador o en el emulador.

## Reglas de programación y colaboración

**Las reglas de programación se escriben, agregan y actualizan en [`.kiro/steering/`](.kiro/steering/). Esa carpeta es la fuente compartida de reglas para Kiro, Codex y cualquier otro LLM.** No mantener copias divergentes de las mismas reglas en instrucciones particulares de cada herramienta.

Este proyecto será desarrollado por más de un LLM. Antes de modificar archivos, cada agente debe leer:

1. [Reglas del proyecto](.kiro/steering/project.md).
2. [Reglas de programación](.kiro/steering/programming.md).
3. [Protocolo de colaboración](.kiro/steering/collaboration.md).
4. [Selección automática](.kiro/steering/task-selection.md), [repositorio de tareas](tasks/README.md) y el archivo de la tarea elegida.
5. [Diseño aprobado](docs/superpowers/specs/2026-10-25-ambient-display-design.md).

`AGENTS.md` actúa como punto de entrada para agentes que descubren ese archivo automáticamente. Las guías de trabajo de `docs/runbooks/` explican procedimientos; no reemplazan las reglas compartidas.

## Estructura

```text
.kiro/steering/                # Reglas comunes, incluidas siempre por Kiro
AGENTS.md                     # Entrada para otros agentes; apunta a steering
tasks/                        # Una tarea por archivo; estado y responsable aquí
  README.md                   # Índice y cómo elegir/delegar tareas
  _template.md                # Plantilla de tarea
docs/
  runbooks/                   # Procedimientos reutilizables para cualquier LLM
  superpowers/specs/         # Diseño aprobado
src/                         # Se creará al implementar
  Ambient.Server/
  ambient-client/
tests/                       # Se creará al implementar
  Ambient.Server.Tests/
```

## Trabajo paralelo

El [índice de tareas](tasks/README.md) indica dependencias y oportunidades de paralelización. El estado vigente y el responsable viven exclusivamente en cada archivo de tarea.

Podés decirle a cualquier LLM **«continuá con la próxima tarea»**. Buscará trabajo elegible, registrará su responsable y estado antes de editar y ejecutará una tarea. Si ninguna puede avanzar, informará los bloqueos y terminará. También podrá revisar entregas ajenas para liberar dependencias.

Se puede trabajar ahora en **T002: guía de Android Emulator**, mientras otro agente hace **T001: contratos compartidos**. El frontend y backend completos esperan esos contratos. En esta misma carpeta, las reservas se serializan mediante un bloqueo breve; con clones separados se necesitan asignaciones explícitas o coordinación compartida.

Para asignar una tarea a otro LLM, usar el [procedimiento de delegación](docs/runbooks/delegate-task.md). Al terminar, debe registrar cambios, pruebas y pendientes en la propia tarea.

## Próximos hitos

1. Contratos y primera demostración panel → SignalR → Canvas.
2. Reconexión, sincronización y apagado lógico.
3. Mensajes temporales y prioridades.
4. Música simulada y disco giratorio.
5. Validación de extremo a extremo en Android Emulator.

Las pruebas en emulador no acreditan autonomía, brillo, temperatura o rendimiento de una tablet física. El apagado web sólo pone el display negro y detiene sus animaciones.
