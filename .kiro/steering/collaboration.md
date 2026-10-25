---
inclusion: always
---

# Colaboración entre LLMs

## Fuente de verdad

Las reglas comunes viven en `.kiro/steering/`. El diseño describe decisiones; `tasks/Txxx-*.md` describe trabajo y su estado. No mantener otro tablero con estados duplicados. Los procedimientos reutilizables viven en `docs/runbooks/` y deben apuntar a estas reglas.

## Antes de editar

1. Leer las reglas, el diseño y la tarea. Revisar `git status` y cambios existentes sin revertirlos.
2. Confirmar dependencias completadas y alcance de archivos sin conflictos. Ante «continuá con la próxima tarea», aplicar `task-selection.md` sin pedir un ID. Las reservas se serializan con su bloqueo breve; editar Markdown por sí solo no evita carreras.
3. Cambiar la tarea a `in_progress`, registrar responsable identificable (herramienta y sesión), fecha ISO con zona horaria y archivos reservados. No empezar si otro responsable figura activo.
4. Si no se puede continuar, registrar el bloqueo concreto y dejar `blocked`; no adivinar un contrato pendiente ni apropiarse de trabajo ajeno.

## Durante el trabajo

- Una tarea activa por agente salvo coordinación explícita. No modificar archivos reservados por otra tarea.
- En un checkout compartido, las ramas no aíslan archivos: no hacer checkout, reset, clean, stash o rebase mientras otro agente trabaja. No revertir, borrar o reformatear cambios ajenos.
- Para trabajo en checkouts separados, acordar rama/base y responsable de integración. No crear worktrees sin necesidad ni cambiar la ubicación acordada sin avisar.
- Contratos, configuración raíz, dependencias y lockfiles requieren un único responsable activo. No instalar paquetes mientras otro agente modifica el mismo manifiesto/lockfile.
- No hacer `git add .` ni commits que incluyan cambios de otro agente. Usar rutas explícitas y revisar el diff staged. No publicar, fusionar o pushear sin autorización del usuario.
- Si aparece trabajo nuevo, crear una tarea acotada con dependencias. No ampliar silenciosamente la tarea actual.
- Avisar al usuario cuando una dependencia se libera y otra tarea puede paralelizarse; indicar ID, alcance y archivos.

## Estados

`ready` → `in_progress` → `review` → `done`.

`blocked` indica dependencia pendiente o impedimento documentado. Se puede volver automáticamente a `ready` si todas sus dependencias están `done`, no tiene responsable activo y no queda otro impedimento. Para devolver una tarea tomada sin cambios, dejar `ready` y explicar el motivo.

`review` significa trabajo preparado con evidencia y entrega escrita. `done` exige criterios de aceptación cumplidos y revisión por otro agente o por el usuario; el revisor registra su identidad y resultado. Los fallos vuelven a `ready` con observaciones para reservar la corrección mediante `task-selection.md`.

## Entrega obligatoria

En la propia tarea: resumen, archivos modificados, pruebas con resultados, limitaciones, decisiones nuevas, revisión e información para continuar. Si hubo commit, incluir hash; si no, decirlo. Nunca registrar secretos.

No dar por abandonada una tarea por antigüedad de su fecha. Consultar al usuario antes de quitar un responsable activo.
