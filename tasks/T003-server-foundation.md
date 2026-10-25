# T003 — Servidor para la primera demostración

- Estado: ready
- Responsable: sin asignar
- Revisor activo: ninguno
- Actualizado: 2026-10-25T19:45:25.0937104-03:00
- Dependencias: T001 done
- Bloqueo: ninguno

## Objetivo

Servidor .NET 10 que autentique control y display y publique cambios de animación y apagado lógico a todos los displays conectados.

## Alcance y archivos reservados

`src/Ambient.Server/**`, `tests/Ambient.Server.Tests/**`, `HomeArtHelper.slnx` y `global.json`. Dueño único de paquetes .NET y solución. No editar frontend, README, configuración Git ni contrato; proponer correcciones de contrato al responsable de T001.

## Fuera de alcance

Música, expiración de mensajes y despliegue LAN definitivo. No exponer implementaciones ficticias que respondan éxito para funciones pendientes.

## Entradas y contratos

`docs/contracts/display-protocol.md` aprobado en T001; seguir nombres y límites exactos. Estado en memoria, única experiencia compartida y publicación ordenada.

## Criterios de aceptación

- [ ] Solución .NET 10 compilable con pruebas backend.
- [ ] Configuración de clave obligatoria; API y hub rechazan clientes sin sesión.
- [ ] Login/logout y protección CSRF/origen conforme al contrato.
- [ ] Estado inicial, actualización de parámetros y on/off con versión creciente y validación de entradas.
- [ ] Conexión/reconexión obtiene estado vigente sin perder una actualización concurrente.
- [ ] Servir frontend compilado cuando esté disponible, con rutas SPA y sin ocultar errores API detrás del fallback.
- [ ] Pruebas de autenticación, CSRF, validación, versiones y sincronización.

## Verificación

`dotnet build HomeArtHelper.slnx` y `dotnet test HomeArtHelper.slnx`. Incluir resultados y configuración de arranque sin secretos en la entrega para T005.

## Entrega

Pendiente. Registrar resumen, rutas, comandos, resultados, limitaciones, commit y revisión.

