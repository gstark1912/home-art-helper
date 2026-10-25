# T005 — Primera demostración integrada

- Estado: ready
- Responsable: sin asignar
- Revisor activo: ninguno
- Actualizado: 2026-10-25T20:39:40.9910537-03:00
- Dependencias: T003 y T004 done
- Bloqueo: ninguno

## Objetivo

Demostrar en la PC el recorrido panel → servidor → display y dejarlo listo para probar en Android Emulator.

## Alcance y archivos reservados

`README.md`, `docs/runbooks/local-development.md`, `tests/integration/**` y scripts de arranque si son necesarios. Cambios de integración en backend/frontend requieren acordar transferencia de esos archivos con sus responsables; no están reservados automáticamente por esta tarea.

## Criterios de aceptación

- [ ] Instrucciones reales de instalación, clave local y arranque, con puertos concretos y sin secretos en Git.
- [ ] Build y pruebas de ambos proyectos exitosos.
- [ ] Dos ventanas autenticadas: cambiar paleta/velocidad desde control modifica el display.
- [ ] Apagar muestra negro y pausa el render; encender restaura el contenido.
- [ ] Reiniciar el servidor permite reconectar y recibir el estado inicial vigente.
- [ ] Comandos sin autenticar o sin protección CSRF requerida se rechazan.
- [ ] Documentar URL del emulador y marcar verificación Android pendiente si el usuario aún no lo tiene listo.
- [ ] Crear tareas acotadas de siguientes hitos y avisar cuáles pueden paralelizarse.

## Verificación

Registrar comandos y evidencia del recorrido real con navegador. No afirmar validación Android sin ejecutarla. No dejar credenciales de prueba en capturas o archivos versionados.

## Entrega

Pendiente. Registrar evidencia, archivos, limitaciones, commit y revisión.


Dependencias liberadas por Codex/01a17555-7620-77e3-9dd4-24056763a55e el 2026-10-25T20:39:40.9910537-03:00: T003 y T004 done. Sin implementación iniciada ni responsable reservado.
