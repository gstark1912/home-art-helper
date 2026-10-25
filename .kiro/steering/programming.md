---
inclusion: always
---

# Reglas de programación

- Mantener soluciones simples, archivos con responsabilidades claras y dependencias justificadas. No crear capas o abstracciones para necesidades hipotéticas.
- Usar TypeScript estricto. Compartir contratos documentados entre frontend y backend; no inventar campos o eventos distintos de `docs/contracts/display-protocol.md` cuando exista.
- El servidor es autoridad del estado. Serializar mutaciones/publicaciones y versionar instantáneas. El cliente descarta versiones viejas y obtiene estado actual al reconectar.
- Validar entradas en el servidor: modos, estilos, rangos numéricos, longitud y duración de mensajes. No renderizar mensajes como HTML.
- Proteger API y hub. No incorporar secretos al código, bundles, URLs, capturas, tareas o logs. Claves locales mediante configuración excluida de Git. Mantener protección CSRF y evitar CORS abierto.
- Evitar trabajo visual cuando el display esté apagado. Liberar timers, listeners y recursos al desmontar. Acotar partículas y resolución Canvas.
- Mantener recursos visuales locales para operar sin Internet. No agregar audio o permisos de micrófono.
- Verificar cambios con builds y pruebas relevantes. Automatizar comportamiento de estado, seguridad y regresiones; no crear pruebas que sólo repitan asignaciones triviales. Registrar comandos y resultados reales.
- No declarar pruebas realizadas si sólo se leyó el código. Separar comprobado, pendiente y bloqueado.
- No cambiar reglas, contratos o archivos ajenos como efecto secundario. Si hace falta, coordinar la ampliación de alcance y actualizar las tareas.
- Mantener README e instrucciones de ejecución coherentes con lo que funciona actualmente.
