# Home&Art Helper — Diseño del MVP

## Propósito y alcance

Cuadro ambiental doméstico controlado desde una web abierta en una PC o celular. La tablet ejecuta exclusivamente el display. El sistema funciona en la LAN sin servicios externos, base de datos, micrófono ni audio.

Primera prueba: abrir /control en la PC y /display en otro navegador o Android Emulator; pulsar un botón y ver cambiar la animación mediante SignalR.

## Enfoques considerados

Se eligió un servidor ASP.NET Core que expone API y SignalR y sirve Vue compilado. Frente a desplegar frontend y backend separados, permite distribuir un único proceso y mantener el mismo origen. Durante desarrollo Vite usa un proxy para API y hub. El usuario aceptó este enfoque.

Se prioriza Android Emulator sobre un simulador web con marco de tablet. Se configura un AVD de tablet y se abre /display en Chrome; posteriormente se valida el mismo frontend en un WebView mínimo o navegador kiosco. El emulador no acredita rendimiento, consumo ni temperatura del hardware físico.

## Componentes y rutas

- src/Ambient.Server: ASP.NET Core, API, hub, autenticación y estado en memoria.
- src/ambient-client: Vue 3, Vite y TypeScript; /control y /display son vistas independientes.
- tests/Ambient.Server.Tests: pruebas del estado, prioridades y autenticación.
- docs: ejecución, pruebas y configuración del emulador.

El display no contiene controles. Pantalla completa requiere un gesto inicial en navegador; el modo kiosco o WebView final se resolverá después. Canvas 2D es suficiente para el MVP.

## Estado y comunicación

El servidor mantiene una única experiencia compartida por todos los displays, con registro de conexiones para diagnóstico. El control individual por dispositivo queda fuera del MVP. Cada modificación produce una instantánea con versión creciente. Una operación serializada ordena mutaciones y publicación; el cliente descarta versiones anteriores.

El hub exige autenticación y envía el estado actual al conectar. El cliente reintenta tanto conexión inicial como reconexiones y solicita una instantánea después de reconectar. Sin conexión conserva el último contenido y los mensajes vencen localmente según la fecha de expiración enviada por el servidor.

El estado contiene modo base, configuración de animación, música simulada, encendido lógico y mensaje temporal opcional. Los mensajes no reemplazan el modo base. Al vencer se muestra la última configuración base, incluso si cambió durante el mensaje. El servidor controla vencimientos; no depende de que haya clientes conectados.

Una prioridad superior interrumpe y descarta el mensaje actual; igual prioridad lo reemplaza; una inferior se rechaza con conflicto. No hay cola. Duración limitada y texto plano, sin HTML. El apagado lógico tiene precedencia visual y no detiene el reloj de vencimiento de mensajes.

## API

POST /api/display/mode, /message, /music, /animation, /screen/on y /screen/off; GET /api/display/status. Se validan enumeraciones, duración y límites numéricos. Parámetros visuales independientes de proveedores: BPM opcional, intensidad, paleta, velocidad y estilo.

## Seguridad

Clave de emparejamiento proporcionada por configuración local, nunca incluida en el bundle ni en URLs. Inicio de sesión genera cookie HttpOnly de sesión; control y display se emparejan separadamente. Mutaciones protegidas contra CSRF y orígenes ajenos; no se habilita CORS abierto. No registrar secretos. Clave ausente impide iniciar el servicio. Sin exposición a Internet. HTTP sólo para desarrollo loopback/emulador; para uso doméstico en red se documenta HTTPS y confianza del certificado. La sesión y su configuración deben probarse también desde el emulador.

## Visuales y rendimiento

Arte inicial de partículas con paletas y velocidad configurables; límite de partículas, densidad de píxel acotada y objetivo de 30 FPS. Detener requestAnimationFrame al apagar y liberar recursos al desmontar. Música simulada con portada local, título, artista y disco giratorio; BPM modifica parámetros sin analizar audio. Mensajes con transición y retorno automático. Pausar también video y animaciones CSS al apagar.

## Hitos verificables

1. Solución .NET y Vue, emparejamiento, Canvas y comando de animación: dos ventanas sincronizadas.
2. Reconexión inicial y posterior, estado consistente, diagnóstico de conexión y apagado lógico.
3. Mensajes temporales, prioridades, expiración y retorno al modo base.
4. Música simulada y disco, parámetros visuales y transiciones.
5. Validación y guía reproducible de Android Emulator, orientación y reconexión.

Cada hito incluye build de backend/frontend y comprobación funcional de su recorrido; pruebas automáticas para comportamiento de estado y seguridad. El entorno actual dispone de dotnet y Node; adb no está en PATH y aún no se verificó instalación de Android Studio.

## Fuera del MVP y decisiones delegadas

Sin Spotify, IA real, n8n, Three.js, control físico de energía, análisis de audio, microservicios ni persistencia. Reloj, videos y simulador web se postergan. Reiniciar el servidor restaura valores iniciales. La elección de puertos, versiones compatibles instaladas, diseño visual concreto y organización interna queda a implementación. No se promete fullscreen silencioso desde Chrome ni equivalencia de rendimiento con una tablet económica.
