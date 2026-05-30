---
title: "Manual de ajustes MiSSiONS"
subtitle: "Para administradores con la contraseña GM"
lang: es
manifest: settings-es
---

# Bienvenido

Este manual cubre cada pantalla detrás de la puerta **Ajustes**
de la app MiSSiONS. Está organizado en tres partes:

- **Parte 1, Administración.** Lo que no está ligado a un tipo de
  partida: la puerta de contraseña, la URL pública, la seguridad,
  las actualizaciones y la plantilla QR que imprimes para el
  acceso de los jugadores.
- **Parte 2, Configuración MiSSiONS.** Ubicaciones, modos,
  misiones y las reglas que los jugadores ven en partida. Es el
  grueso del trabajo diario.
- **Parte 3, Configuración CityRush.** Un tipo de partida
  separado con sus propios modos, misiones con objetivo GPS,
  pistas y misiones especiales.

CityRush está separado a propósito, comparte el armazón de los
ajustes pero tiene su propia lógica (objetivos GPS, secuencias de
pistas, misiones especiales) que no aplica a las partidas
MiSSiONS. Si solo usas uno de los dos, puedes saltarte la otra
parte.

La contraseña para entrar en los ajustes la tiene quien instaló
la app y no debe compartirse a la ligera, cualquiera que la tenga
puede cambiar cada regla, misión y la contraseña misma. El valor
por defecto tras una instalación limpia es `admin1898`; cámbialo
en la pestaña Seguridad cuanto antes.

> Las capturas de este manual se tomaron en una base de demo
> limpia con tres ubicaciones (Altstadt, Stadtpark,
> Hauptbahnhof), seis misiones y un modo CityRush con tres
> misiones. Tu instalación real se verá igual pero con tus
> propios datos.

::part:1:Administración

# La puerta de contraseña

::shot:adm-01-gate

Toca el icono de engranaje arriba a la derecha de la pantalla de
inicio. Verás la puerta de contraseña de arriba. Escribe la
contraseña GM y pulsa **Desbloquear** (o Intro). ¿Contraseña
incorrecta? El campo tiembla y aparece un error rojo debajo.
Pulsa **Atrás** para volver a la pantalla de inicio.

Cada pestaña de ajustes está tras esta puerta, así que quien no
quieras que tenga acceso admin completo no debería tener la
contraseña.

# General

::shot:adm-02-general

**URL pública.** La dirección que los jugadores usan para llegar
a tu partida. Cuando ejecutas `start-tunnel-windows.bat`, el
túnel rápido de Cloudflare incluido imprime una URL como
`https://abc-def-ghi.trycloudflare.com`. Haz clic en
**Detectar** y la app la encuentra automáticamente. También
puedes pegarla manualmente si alojas la app de otra forma.

**Mensaje de fin de partida.** Cuando el temporizador de una
partida se agota, este mensaje se muestra a cada jugador.
Escríbelo una vez por idioma; el botón **🌐 Auto** rellena los
idiomas vacíos a partir del que empezaste. Guarda antes de salir
de la pestaña.

# Seguridad

::shot:adm-03-security

Cambia la contraseña GM. Escribe tu contraseña actual, luego la
nueva dos veces. La nueva contraseña surte efecto de inmediato y
aplica a cada operador en cada dispositivo, asegúrate de tener
una forma de comunicarla antes de cambiarla.

# Actualizaciones

::shot:adm-04-updates

La app puede actualizarse directamente desde GitHub. Configura la
**URL del repositorio GitHub** una vez (p. ej.
`https://github.com/tu/missions-app`); el campo **Versión**
muestra la versión instalada actualmente. Pulsa **Actualizar
ahora** y la app ejecuta `git pull && npm install --production` y
se reinicia. La salida aparece en el cuadro de abajo para
confirmar qué cambió.

**Cuidado con esto en mitad de una partida en vivo**, el
reinicio cortará brevemente la conexión de cada jugador. Se
reconectan automáticamente, pero sigue siendo disruptivo.
Actualiza entre sesiones, no durante ellas.

# Plantilla QR

::shot:adm-05-template

Para ubicaciones donde imprimes tarjetas de acceso físicas (una
hoja plegada con tu marca más un código QR), sube aquí tu PNG de
plantilla y arrastra el marcador QR naranja a donde debe caer el
código. Elige primero un tamaño de papel, A4 por defecto.
**Guardar posición** persiste el marcador, y **Eliminar
plantilla** vacía la subida. Cuando un GM crea una nueva partida,
el QR se renderiza sobre esta plantilla en la posición que
fijaste.

::part:2:Configuración MiSSiONS

# Ubicaciones

::shot:m-01-locations

Una **ubicación** es un lugar físico donde se desarrollan las
partidas. La demo tiene tres: Altstadt, Stadtpark y
Hauptbahnhof. Cada ubicación tiene su propia biblioteca de
misiones, cuando un GM arranca una partida en «Altstadt», los
jugadores reciben las misiones de Altstadt más cualquier misión
del **Pool** (misiones no ligadas a una ubicación específica).

Usa el botón **+ Ubicación** (arriba de la lista) para añadir
una. Haz clic en **Editar** en una tarjeta para cambiar nombre o
reglas. **Eliminar** quita la ubicación y **todas sus misiones**,
confirma con cuidado.

::shot:m-02-locations-add

El cuadro Añadir ubicación:

- **Nombre**: lo que el GM ve al elegir una ubicación.
- **Mín. MiSSiONS de ubicación**: al arrancar una partida, el
  motor garantiza este número de misiones sacadas de esta
  ubicación (el resto viene del pool). Úsalo para que las
  partidas siempre sienten apropiadas a la ubicación.
- **Permitir foto / vídeo / interior**: si misiones de esos
  tipos pueden seleccionarse desde esta ubicación. Desactivar
  «interior» es útil para ubicaciones solo exteriores donde el
  clima es fiable.

# Modos y la biblioteca de misiones

::shot:m-03-missions

La biblioteca de misiones se divide por **modo** (la barra
superior, MiSSiONS, ADVANCED, etc.) y por **ubicación** (el
desplegable). Una misión pertenece a exactamente un modo y a una
sola ubicación o al Pool global.

**Pestañas de modo.** Cada modo es una biblioteca de misiones
separada ligada a un conjunto de reglas y un temporizador. Haz
clic en **+ Modo** para añadir uno. Haz clic en ✎ para editar el
nombre, conjunto de reglas o duración por defecto de un modo. El
primer modo («MiSSiONS», id 1) no se puede eliminar, es el
predeterminado seguro.

**Filtro de ubicación.** «Todas» muestra todo en el modo actual;
elige una ubicación para ver solo sus misiones; **Pool** muestra
solo las misiones del modo sin ubicación.

**Acciones en lote.** Marca las casillas en las misiones, luego
usa la barra que aparece: **Copiar a modo…** para duplicar
misiones en otro modo, o **Exportar** para descargar un archivo
JSON que puedes importar en otro sitio.

**Importar.** El botón **⬆ Importar** lee un archivo JSON con la
misma forma que produce Exportar, útil para mover misiones entre
instalaciones.

::shot:m-04-mission-add

Cada misión tiene cinco campos de idioma para su nombre,
descripción y tarea. No intentes rellenar los cinco a mano;
escribe un idioma bien, luego haz clic en **🌐 Auto** arriba de
la sección de nombre para rellenar el resto automáticamente.
Edita después si la traducción necesita pulido.

- **Ubicación**: restringe la misión a una ubicación (o déjala en
  Pool para cualquiera).
- **Modo**: normalmente preseleccionado al que estabas viendo.
- **Tipo de medio**: foto o vídeo. Los jugadores quedarán
  bloqueados en ese formato al enviar.
- **Puntos**: cuántos puntos recibe el equipo cuando apruebas su
  envío. Las penalizaciones por subidas tardías se restan de
  estos.
- **También interior**: actívalo cuando la misión se pueda hacer
  dentro (misiones de respaldo por lluvia). Las ubicaciones con
  «permitir interior» desactivado se saltarán estas aunque estén
  en el modo.

Las pestañas **Descripción** y **Tarea**:

- **Descripción** es la historia/contexto mostrada sobre el
  botón de cámara.
- **Tarea** es la instrucción explícita «haz esto», mantenla
  corta.

Haz clic en **Guardar** cuando termines. La misión aparece en la
lista de inmediato.

# Reglas

::shot:m-05-rules

Un **conjunto de reglas** es una lista de reglas mostrada a los
jugadores en la ventana de Reglas en partida. El **Standard**
inicial no se puede eliminar, pero puedes añadir otros (p. ej.
una variante familiar) y asignar distintas reglas a distintos
modos.

Para cada línea de regla puedes usar los marcadores `[photo]`,
`[video]`, `[indoor]`, que se expanden en pequeños iconos en la
vista de jugador. Arrastra las reglas arriba/abajo para
reordenar; el botón 🌐 en una regla la auto-traduce; el botón ⎘
copia una regla a otro conjunto. Pulsa **Guardar** cuando
termines, las ediciones sin guardar se resaltan.

::part:3:Configuración CityRush

CityRush es un tipo de partida separado. Los jugadores caminan
físicamente hacia marcadores en un mapa, llegan a cada objetivo y
completan una tarea allí. El panel de ajustes CityRush refleja el
diseño de MiSSiONS pero con campos extra por misión para
coordenadas, secuencias de pistas y misiones especiales. Los
modos y misiones configurados aquí se ofrecen **solo** cuando el
GM arranca una partida CityRush, no aparecen en las partidas
MiSSiONS y viceversa.

# Modos CityRush

::shot:cr-01-modes-empty

La pestaña CityRush funciona como la pestaña MiSSiONS: una fila
de pestañas de modo arriba, luego las misiones del modo activo
debajo. Haz clic en **+ Modo** a la derecha de la barra de modos
para crear un nuevo modo CityRush.

::shot:cr-02-mode-add

Un modo CityRush lleva sus propios:

- **Nombre**: lo que el GM elige del desplegable al arrancar una
  partida.
- **Conjunto de reglas**: la misma lista que MiSSiONS, pero las
  reglas aplican a las partidas de este modo.
- **Medios permitidos**: foto, vídeo o ambos. Afecta qué
  misiones por tipo de medio se permiten en este modo.
- **Duración por defecto (minutos)**: el temporizador con el que
  arranca la partida.

# Misiones CityRush

::shot:cr-03-mission-add

Una misión CityRush tiene cada campo que tiene una misión
MiSSiONS, más los extras conscientes de la ubicación:

- **Coordenadas GPS + radio**: dónde está el objetivo y a qué
  distancia (metros) deben llegar los jugadores antes de que la
  tarea se desbloquee. Usa un radio pequeño (15–25 m) en manzanas
  densas; mayor (40–60 m) en parques abiertos.
- **Mostrar en el mapa**: si el marcador objetivo es visible
  para los jugadores. Desactívalo para misiones «encuentra el
  camino solo con las pistas».
- **Pistas GPS**: reveladas una a una mientras el equipo camina;
  útiles cuando el marcador está oculto o el área es grande.
- **Pistas de tarea**: reveladas una a una tras la llegada,
  cuando los equipos se atascan en la tarea misma.
- **Medio requerido**: foto o vídeo; mutuamente excluyente con el
  campo de respuesta de abajo.
- **Cronometrado**: cuando un equipo toca «Iniciar», empieza una
  cuenta atrás. Las penalizaciones entran cuando se excede;
  configura el intervalo de penalización y los puntos justo
  debajo.

## Misiones en modo respuesta

::shot:cr-04-mission-answer

Activa **Tiene respuesta** para convertir la misión en un reto
«escribe la palabra correcta». El campo **Respuesta(s)** acepta
una lista separada por `|` e ignora mayúsculas y espacios, así
que `Eule|Owl|Hibou|Civetta` coinciden todas. Es mutuamente
excluyente con foto/vídeo, elige un modo por misión.

## Misiones especiales

::shot:cr-05-mission-special

Activa **Misión especial** para sacar la misión de la secuencia
lineal. Las misiones especiales:

- Aparecen en el panel ⭐ del jugador, jugables en cualquier
  momento y orden.
- Se saltan por completo el paso de llegada GPS, aunque pongas
  coordenadas.
- Usan un **Cooldown** (minutos) para limitar los reintentos:
  `0` significa que cada equipo solo puede jugarla una vez; `5`
  significa cinco minutos entre intentos. Un rechazo del GM
  borra el cooldown de inmediato.

Guarda cuando termines. Los jugadores que ya empezaron una
partida no verán las misiones añadidas a mitad de partida,
publícalas antes del lanzamiento.

---

## Consejos para la operación diaria

- Usa **Traducir automáticamente** con liberalidad tanto en
  misiones MiSSiONS como CityRush, tener los cinco idiomas
  perfectos a mano es una lata que la IA hace bastante bien la
  mayoría de las veces.
- Las **misiones Pool** (solo MiSSiONS) son **relleno**, no un
  respaldo por lluvia. Siguen siendo misiones de exterior, la
  diferencia es que no están ligadas a una ubicación específica,
  así que el motor puede traerlas a cualquier partida para
  completar un modo que de otro modo tendría muy pocas misiones
  específicas de ubicación. Usa la marca **También interior** en
  misiones individuales si las quieres jugables con mal tiempo;
  es una propiedad separada de Pool.
- Para CityRush, **prueba siempre el radio a pie**, el GPS de un
  teléfono rara vez es preciso hasta 5 metros en una zona
  construida, y un radio demasiado ajustado deja a los equipos
  atascados.
- **Exporta tus misiones de vez en cuando** como respaldo. El
  JSON es pequeño, legible y puedes reimportar tras un borrado
  de base de datos.
- **No actualices a mitad de sesión.** Funciona, pero quedarás
  mal ante quien esté jugando.
