---
title: "Manual del Gamemaster MiSSiONS"
subtitle: "Para los operadores que dirigen partidas en directo"
lang: es
manifest: gm-es
---

# Bienvenido, Gamemaster

Este manual es para ti si **diriges partidas en directo**: recibir
a los equipos, entregarles el código de acceso, aprobar sus fotos
y vídeos, enviar difusiones cuando algo necesita la atención de
todos, congelar a los equipos pillados en foto y terminar la
partida cuando se acabe el tiempo.

Está dividido en dos partes porque la app soporta dos tipos de
partida distintos:

- **Parte 1, partidas MiSSiONS.** El modo clásico: arrancas una
  partida en una ubicación física, los jugadores se unen,
  recorren una lista curada de misiones foto/vídeo y tú apruebas
  sus envíos.
- **Parte 2, partidas CityRush.** Un modo guiado por GPS donde
  los jugadores caminan físicamente hasta marcadores en un mapa,
  llegan a cada objetivo y completan la tarea allí. El panel se
  parece pero añade un mapa, señales de llegada GPS y misiones
  especiales.

Si solo diriges uno de los dos, puedes saltarte la otra parte —
no se solapan y cada partida se queda en su modo.

**No** necesitas la contraseña de ajustes para nada de esto. Todo
en este manual funciona sin ella. Si algo en pantalla requiere un
admin, el manual lo dirá; tu papel es operar, no configurar.

> Las capturas muestran una partida de demo con dos equipos
> («Team Rot» / «Team Grün» para MiSSiONS; «Team Blau» / «Team
> Gelb» para CityRush). Tus partidas reales se verán igual con
> tus propios nombres de equipo y misiones.

::part:1:Dirigir partidas MiSSiONS

# La pantalla de inicio

::shot:m-01-landing

Aquí empieza cada sesión. Ves una casilla por ubicación más una
casilla CityRush abajo. Toca la ubicación donde jugará tu grupo;
la app recuerda tu elección para la próxima vez.

Los botones de la cabecera:

- **Versión** (arriba a la izquierda, pequeño): qué build de la
  app está instalada.
- **DE / EN / FR / IT / ES** (arriba a la derecha): rota el
  idioma de la interfaz GM.
- **⚙ Ajustes**: abre la puerta de contraseña. Si no tienes la
  contraseña, no toques.

# Elegir un modo y arrancar una partida

::shot:m-02-game-select

Tocar una ubicación te lleva aquí. La lista de abajo muestra las
partidas ya creadas allí (la más reciente primero), cada una con
su ID, fecha de creación, estado (esperando / jugando /
terminada) y cuántos equipos se han unido. Toca **Abrir** en
cualquiera para saltar a su panel; útil si saliste por error.

Para arrancar una nueva partida:

1. Elige un **modo** del desplegable. El modo decide qué
   biblioteca de misiones, conjunto de reglas y temporizador se
   usan. «MiSSiONS» es el predeterminado; los admins pueden
   haber añadido otros (p. ej. ADVANCED).
2. Toca **+ Nueva partida**.

La app crea la partida, elige la mezcla correcta de misiones
para la ubicación y te muestra un botón **Abrir panel →** más
una ventana QR que puedes mostrar o imprimir para que los
jugadores se unan.

# El panel de control

::shot:m-03-dashboard

Tu centro de mando para una partida en curso. Cuatro zonas:

- **Barra superior**: ID de partida, **temporizador
  start/pause** y los iconos QR / 🎬 / engranaje / idioma a la
  derecha. El botón 🎬 está gris durante el juego y se enciende
  al terminar la partida, ver *Exportar fotos y vídeos de la
  partida* más abajo.
- **Fichas de equipo**: una por equipo que se ha unido, con su
  puntuación actual. Una **🔔** en una ficha significa que hay
  algo pendiente para ese equipo, normalmente un envío a
  revisar.
- **Área principal** (izquierda): tarjetas de misión del equipo
  seleccionado, o la lista de equipos si ninguno está
  seleccionado.
- **Panel derecho**: pestañas Chat y Difusión. (Las partidas
  CityRush añaden una tercera pestaña de mapa aquí, ver Parte 2.)

El temporizador parte de la duración configurada (60 minutos por
defecto). Toca **▶ Iniciar** para empezar la cuenta atrás. Toca
**⏸ Pausa** para parar el reloj para todos. La pausa es para
**dificultades técnicas o emergencias solamente** (problema de
servidor, red caída, incidente real); no la uses para descansos
casuales. **Reiniciar** vuelve a poner el temporizador al máximo.

# Revisar los envíos de un equipo

::shot:m-04-team-detail

Toca una ficha de equipo para abrir su vista de detalle en el
área principal. Cada misión asignada se vuelve una tarjeta. Las
tarjetas con un envío pendiente (como «Fountain selfie» arriba)
se encienden con un borde naranja y muestran:

- Una **miniatura** de lo que el equipo subió.
- Un botón **Aceptar** (✓) y un **Rechazar** (✗).
- El nombre, descripción y tarea de la misión como referencia.

Toca **Aceptar** para asignar los puntos. El equipo recibe un
toast 👍 y un tick verde en su copia de la misión.

Toca **Rechazar** para rechazar. Un cuadro pide el motivo
(descrito después).

## Ampliar una imagen

::shot:m-05-lightbox

Toca la miniatura para abrir la lightbox; la imagen llena la
pantalla para que puedas juzgar de verdad si el equipo hizo la
tarea. Dos controles flotan arriba a la derecha:

- **↻ Rotar**: rota la imagen 90° en sentido horario por clic.
  Útil para fotos hechas en vertical pero guardadas en
  horizontal, o al revés. La rotación solo afecta a lo que ves,
  no modifica el archivo guardado.
- **✕**: cierra la lightbox. También puedes tocar el fondo
  oscuro.

::shot:m-06-lightbox-rot

La misma foto tras un clic en **↻ Rotar**. Sigue tocando para
rotar más (180°, 270°, vuelta a 0°). Una vez decidido, cierra la
lightbox y usa Aceptar o Rechazar en la tarjeta.

Para vídeos, la lightbox muestra un reproductor en vez de una
imagen fija; no se necesita botón de rotación porque el vídeo
lleva sus propios metadatos de orientación.

## Rechazar

::shot:m-07-reject-modal

Si tocas **Rechazar**, se abre este pequeño cuadro. Escribe un
motivo corto; **el equipo ve este texto** en su chat de jugador,
así que sé honesto y específico. Ejemplos que funcionan: «Muy
oscuro, vuelve cerca de la farola», «Fuente incorrecta, prueba la
de delante de la iglesia», «Falta la mitad del equipo».

Pulsa **Rechazar y notificar** para confirmar. El equipo recibe
un toast 👎, el envío se elimina del almacenamiento y la misión
vuelve a estar disponible.

Si un jugador subió un selfie o una foto de chat por error en
lugar de la foto de misión, también la verás en la tarjeta;
rechaza con «envío equivocado» y el equipo puede reintentar.

# Difundir a todos

::shot:m-08-broadcast

Cambia el panel derecho a **Difusión**. Escribe un mensaje y
toca **📢 Enviar a todos**. La ventana de chat de cada equipo
recibe el mensaje al mismo tiempo con una pequeña etiqueta
«Broadcast» para que sepan que no va dirigido solo a ellos.

Útil para cosas como:

- «¡5 minutos para el final, vuelvan al punto de encuentro!»
- «Chubasco breve, pueden refugiarse bajo un portal.»
- «Hipo del servidor, temporizador pausado dos minutos, sentimos
  esto.»

Los comentarios individuales van en la pestaña **Chat**; la
difusión es para todos.

# Chat por equipo

::shot:m-09-chat

La pestaña por defecto del panel derecho es **Chat**, vinculada
al equipo actualmente seleccionado en el área principal. Escribe
un mensaje, pulsa Intro o **Enviar**, y el equipo lo ve en su
chat de jugador.

Cuando un equipo te escribe, la insignia de su pestaña chat se
enciende con un punto naranja. Cambia al equipo que escribió, lee
el mensaje, responde. El punto es por equipo; puedes tener
mensajes no leídos de un equipo mientras el chat de otro está
delante.

# Cosas que no puedes hacer sin la contraseña

::shot:m-10-settings-gate

Esto es lo que ves si tocas el engranaje **⚙** sin la contraseña
GM. Todo lo que hay tras esta puerta es solo para admin:

- Añadir/eliminar ubicaciones o misiones
- Editar reglas
- Cambiar la plantilla QR o la contraseña GM
- Actualizar la app

Si encuentras una misión con info errónea o una regla que debería
cambiar, anótalo y pídele a quien gestiona tu instalación que la
actualice entre sesiones.

::part:2:Dirigir partidas CityRush

CityRush es el tipo de partida guiado por GPS. En lugar de hacer
misiones en una sola ubicación, los jugadores caminan
físicamente entre objetivos en un mapa, llegan a cada objetivo y
completan la tarea allí. Todo lo que sabes de MiSSiONS sigue
aplicándose — el panel, las fichas de equipo, el chat, la
difusión, la herramienta de congelación, la lightbox — pero la
partida arranca diferente y hay una pestaña **mapa** extra.

# Arrancar una partida CityRush

::shot:cr-01-landing

Toca la casilla **CityRush** abajo en la pantalla de inicio en
lugar de una ubicación regular. La casilla muestra un icono de
corredor y un conteo de modos CityRush disponibles debajo.

::shot:cr-02-game-select

La pantalla de selección de partida para CityRush funciona como
la de MiSSiONS, pero el desplegable es el selector de **modo
CityRush** (Altstadt-Tour en esta demo) en lugar del selector
modo-por-ubicación. Elige un modo, toca **+ Nueva partida** y la
app genera el QR + panel.

# El panel CityRush

::shot:cr-03-dashboard

El diseño del panel es idéntico a MiSSiONS — fichas de equipo
arriba, tarjetas de misión en el área principal cuando
seleccionas un equipo, panel chat/difusión/mapa a la derecha.
Las pestañas Chat y Difusión funcionan exactamente igual que en
las partidas MiSSiONS.

Las diferencias están todas en las **tarjetas de misión** y la
pestaña **🗺️ mapa**.

# Las misiones de un equipo CityRush

::shot:cr-04-team-detail

Cada tarjeta de misión CityRush se parece a una tarjeta MiSSiONS
con algunos extras:

- Un **número de secuencia** a la izquierda (`1`, `2`, `3`…):
  las misiones CityRush están ordenadas y los jugadores las
  desbloquean una a una. Un equipo debe llegar a la misión 1
  antes de que la misión 2 sea siquiera visible.
- Un prefijo **⭐** en las **misiones especiales**: no siguen la
  secuencia; los jugadores pueden hacerlas en cualquier momento
  desde un panel separado.
- Un estado **❔** cuando el equipo aún no ha llegado, sustituido
  por la tarea real y una UI Aceptar/Rechazar una vez en el sitio
  y tras enviar medios o respuesta.

Aceptación, rechazo, lightbox y rotación funcionan exactamente
como en MiSSiONS, ver las capturas m-04–m-07 en la Parte 1.

# El panel del mapa

::shot:cr-05-map

Cambia el panel derecho a **🗺️** para ver el mapa en vivo. Los
marcadores son los objetivos de misión, en el orden en que se
recorren. Los puntos de posición de equipo aparecen según se
mueven (siempre que hayan concedido permiso de localización en
su vista de jugador).

Las misiones especiales no aparecen en el mapa, no tienen
posición fija.

El mapa tiene un **conmutador a pantalla completa** (arriba a la
derecha) para expandirlo al área principal completa; toca de
nuevo para restaurar. Usa el pantalla completa cuando quieras
ver dónde están todos los equipos a la vez.

> Las misiones especiales intencionalmente no tienen objetivo
> GPS. Si has configurado una sin coordenadas, vive en el panel
> ⭐ del jugador, no en este mapa.

# Congelar a un equipo pillado en foto (solo CityRush)

::shot:cr-06-freeze

El botón **❄ Congelar** es una mecánica PvP exclusiva de
CityRush construida en torno al «pillado en foto». El flujo:

1. El equipo A pilla al equipo B en algún sitio del recorrido y
   les hace una foto.
2. El equipo A te envía esa foto como envío de misión (o vía
   chat, según cómo lo hayas configurado).
3. Verificas que el equipo B esté realmente en la foto y
   aceptas el envío.
4. Abres el detalle del **equipo A** (el fotógrafo, que es el
   congelador) y tocas **❄ Congelar**. En la ventana, elige
   **el equipo B** como objetivo y una duración (1, 3, 5 o 10
   minutos), luego confirma.

El equipo actualmente seleccionado en el área principal es
siempre el **congelador**; la ventana elige luego qué **otro**
equipo congelar. No te equivoques: abrir primero el detalle del
equipo B significaría que el equipo B se vuelve el congelador,
lo opuesto de lo que quieres.

Mientras está congelado, el equipo B ve un overlay «estáis
congelados, el GM os descongelará en N minutos»; su temporizador
se para, no pueden subir nada y no pueden validar llegadas a
objetivos. El equipo A ha usado su único disparo de congelo
contra el equipo B (ver abajo).

Este es el **único** uso legítimo del botón de congelo. No lo
uses como pausa neutra, castigo genérico o para darle un
descanso a un equipo.

¿Por qué solo CityRush? En las partidas MiSSiONS cada equipo
trabaja en su propia lista en un solo sitio, así que no hay nada
que pillarse mutuamente en foto. Los equipos CityRush comparten
un recorrido, por eso existe la mecánica «pillado en foto».

Recordatorio sobre la dirección de la ventana: la abres desde el
detalle del congelador (equipo A en la historia de arriba). La
ventana pregunta luego qué otro equipo congelar (equipo B). El
equipo cuyo detalle estás viendo nunca es el que acaba
congelado. Toca **Congelar** para confirmar. Los equipos se
descongelan automáticamente al vencer el tiempo, o puedes
**Descongelarlos** antes con el botón 🔥 que sustituye al
botón de congelo mientras un equipo está congelado.

Cada equipo puede congelar a cualquier rival **una sola vez por
pareja**: el selector pone en gris a los rivales sobre los que
el congelador ya usó su disparo. Es un arma de un solo uso por
pareja, no una molestia constante.

---

## Checklist de fin de partida (ambos modos)

Cuando el temporizador llega a cero (o tocas **Terminar
partida** antes), la app:

- Muestra tu mensaje de fin a cada jugador.
- Congela la tabla / clasificación.
- Marca la partida como «terminada» en la lista del panel.

Antes de irte:

1. Haz una captura de la **Clasificación** en el panel derecho,
   útil para la ceremonia de premios si no confías en que los
   jugadores lo recuerden.
2. Rechaza o acepta todos los envíos pendientes restantes; no
   los dejes colgando.
3. Si un equipo hizo un envío de mala fe (fuera de tema,
   inapropiado), toca **Rechazar** con un motivo; el envío se
   elimina del almacenamiento.

Puedes dejar el panel abierto y volver luego; las partidas
terminadas se quedan en la lista bajo su ubicación (o bajo
CityRush).

---

## Exportar fotos y vídeos de la partida

Una vez terminada la partida, el icono **🎬** arriba a la
derecha del panel se enciende. Haz clic para abrir el panel de
exportación:

- **📦 Descargar ZIP (todo el medio)**: envía cada foto y vídeo
  aceptado de cada equipo a tu navegador como
  `missions-<game-id>.zip`. Dentro, cada equipo tiene su carpeta
  con el selfie de equipo y cada envío aprobado, nombrados en
  orden de aceptación para preservar la cronología. Es el
  entregable de archivo: dáselo al cliente o guárdalo.
- **🎬 Renderizar collage foto**: arranca un render del lado del
  servidor de una sola presentación MP4. Cada equipo tiene una
  tarjeta de título con su nombre, seguida de sus fotos
  aceptadas en orden (unos dos segundos por foto). Los vídeos
  **no** están en el collage, solo en el zip, porque re-codificar
  vídeos de equipo en presentación hace el render mucho más
  largo. Una barra de progreso muestra el estado; al terminar el
  MP4 se descarga automáticamente.

Unas notas prácticas:

- El render corre en el servidor. Puedes cerrar la ventana una
  vez arrancado; reabrirla más tarde retoma donde estaba si el
  render sigue.
- Una partida típica con 30–40 fotos aceptadas renderiza en
  30–60 segundos.
- La exportación cubre **solo** los medios aceptados. Los envíos
  rechazados ya se eliminaron del almacenamiento en el momento
  del rechazo, no pueden reaparecer aquí.
- Renderizar otra vez sustituye el collage previo. El zip se
  genera fresco en cada descarga.

---

## Preguntas comunes

**Un equipo dice que subió un vídeo pero no aparece nada.**
Mira el detalle del equipo; a veces una subida de vídeo falla
silenciosamente por mala conexión. Pídeles que vuelvan a subir
desde la tarjeta de misión.

**El teléfono del equipo dice «congelado» pero yo no los
congelé.**
Un compañero pudo disparar un congelo automático (p. ej.
intentando enviar dos veces seguidas). El panel muestra el
congelo activo y un botón 🔥 para descongelarlos.

**Un equipo se unió a la partida equivocada.**
Cada partida tiene su propia URL/QR de acceso. Si les diste el
código equivocado, termina esa partida (o ignórala) y haz que se
unan a la correcta. No hay migración; empiezan de cero.

**Un equipo CityRush no ve la siguiente misión.**
Probablemente no han llegado físicamente al radio del objetivo
actual. Mira el panel del mapa; su punto debería estar dentro
del círculo del objetivo. Si lo está y la misión sigue sin
desbloquearse, su precisión de localización puede ser demasiado
mala; haz que salgan al aire libre y esperen unos segundos.

**Los jugadores dicen no ver las misiones en su idioma.**
Cada jugador elige su idioma en la pantalla de acceso. Si está
mal en su dispositivo, toca el botón 🌐 en su vista de jugador,
no en el panel GM.

**¿Puedo dirigir dos partidas en la misma ubicación a la vez?**
Sí, el panel de cada una es independiente. Solo asegúrate de
que cada equipo se une al ID de partida correcto.
