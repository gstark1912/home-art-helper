---
inclusion: always
---

# Contexto y límites

Home&Art Helper es un display ambiental doméstico. El panel remoto se usa fuera de la tablet; el display sólo muestra contenido. La PC aloja el servidor local. Android Emulator es el entorno inicial de validación Android; el simulador web con marco se posterga.

Stack acordado: ASP.NET Core .NET 10, Vue 3 + Vite + TypeScript, SignalR, Canvas 2D. Un servidor sirve API y frontend compilado; Vite usa proxy en desarrollo. Estado en memoria y una experiencia compartida por todos los displays durante el MVP.

Prioridad: demostración funcional panel → comando → cambio inmediato de animación. Después: conexión robusta, mensajes temporales, música simulada y validación Android. Consultar el diseño en `docs/superpowers/specs/2026-10-25-ambient-display-design.md`.

No introducir microservicios, base de datos, servicios cloud, integración real de Spotify/IA/n8n, análisis de audio o control físico de energía en el MVP. Las animaciones no dependen de Spotify. El apagado lógico pausa Canvas, video y animaciones CSS, manteniendo la conexión disponible.

Si un requerimiento nuevo contradice el diseño, documentar la decisión y actualizar las tareas afectadas antes de continuar con ese cambio. Las instrucciones explícitas del usuario prevalecen sobre estas reglas.
