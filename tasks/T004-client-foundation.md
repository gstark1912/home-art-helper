# T004 — Panel y display Canvas

- Estado: ready
- Responsable: sin asignar
- Revisor activo: ninguno
- Actualizado: 2026-10-25T19:45:25.0937104-03:00
- Dependencias: T001 done
- Bloqueo: ninguno

## Objetivo

Vue con panel externo y display visual, conectados al servidor mediante el contrato aprobado. El display es el mismo en escritorio y Android.

## Alcance y archivos reservados

`src/ambient-client/**`. Dueño único de package.json y lockfile dentro de esa carpeta. No crear package.json raíz ni editar backend, README, contrato o tareas ajenas.

## Fuera de alcance

Simulador web con marco, música, mensajes, WebView nativo y control físico de pantalla.

## Entradas y contratos

`docs/contracts/display-protocol.md` de T001. Puede trabajar con ejemplos de ese contrato antes de T003, pero no declarar integración real hasta T005.

## Criterios de aceptación

- [ ] Vue 3, Vite, TypeScript estricto; builds reproducibles con lockfile y proxy configurable.
- [ ] `/control` muestra login, estado y botones para paleta/velocidad y apagado lógico; comunica fallos reales.
- [ ] `/display` muestra login si hace falta y luego exclusivamente Canvas; fullscreen mediante gesto inicial cuando sea necesario.
- [ ] Partículas estéticas con recursos locales, límite de densidad/píxel y objetivo de 30 FPS.
- [ ] Detener animaciones al apagar; reanudarlas al encender; liberar recursos al desmontar.
- [ ] Reconexión inicial y posterior; recibir estado vigente y descartar versiones viejas.
- [ ] Pruebas relevantes de aplicación de instantáneas, reconexión y pausa; no sustituir evidencia funcional por mocks.

## Verificación

Desde `src/ambient-client`: `npm ci`, `npm run build`, `npm test` (definir script reproducible). Registrar pruebas visuales ejecutadas y las pendientes para integración.

## Entrega

Pendiente. Registrar resumen, rutas, comandos, resultados, limitaciones, commit y revisión.

