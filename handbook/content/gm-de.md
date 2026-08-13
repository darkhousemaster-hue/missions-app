---
title: "MiSSiONS Gamemaster-Handbuch"
subtitle: "Für Operator, die Spiele live leiten"
lang: de
manifest: gm-de
---

# Willkommen, Gamemaster

Dieses Handbuch ist für dich, wenn du **Spiele live leitest**: Teams
begrüssen, ihnen den Zugangscode geben, Fotos/Videos freigeben oder
ablehnen, Broadcast-Nachrichten verschicken, Teams einfrieren wenn
nötig, und das Spiel beenden, wenn die Zeit abläuft.

Das Handbuch ist in zwei Teile gegliedert, weil die App zwei
unterschiedliche Spieltypen unterstützt:

- **Teil 1, MiSSiONS-Spiele.** Der klassische Modus: Du startest
  ein Spiel an einem physischen Standort, Spieler treten bei,
  arbeiten eine kuratierte Liste von Foto/Video-Missionen ab, und du
  prüfst ihre Uploads.
- **Teil 2, Rail Adventure Spiele.** Ein Modus mit zwei Arten von
  Aufgaben: **Missionen** (überall lösbar, ohne GPS) und
  **Checkpoints** (GPS-Ziele, zu denen Spieler physisch laufen).
  Spieler wechseln immer ab — eine Mission, dann ein Checkpoint, dann
  eine Mission … — und jede muss vom GM angenommen werden, bevor die
  nächste gemacht werden kann. Das Dashboard sieht ähnlich aus, hat
  aber eine Karte, GPS-Ankunfts-Signale und Sondermissionen.

Wenn du immer nur einen der beiden Typen verwendest, kannst du den
anderen Teil überspringen, sie überlappen nicht und jedes Spiel
bleibt in seinem Modus.

Du brauchst das **Einstellungs-Passwort dafür nicht**. Alles in
diesem Handbuch funktioniert ohne. Wenn etwas am Bildschirm einen
Admin braucht, wird das ausdrücklich erwähnt, dein Job ist
Betreiben, nicht Konfigurieren.

> Screenshots zeigen ein Demo-Spiel mit zwei Teams ("Team Rot" /
> "Team Grün" für MiSSiONS; "Team Blau" / "Team Gelb" für Rail Adventure).
> Deine echten Spiele sehen genauso aus, mit deinen eigenen Namen
> und Missionen.

::part:1:MiSSiONS-Spiele leiten

# Der Startbildschirm

::shot:m-01-landing

Hier beginnt jede Session. Du siehst eine Kachel pro Standort plus
ganz unten eine Rail Adventure Kachel. Tipp auf den Standort, an dem dein
Team spielt, die App merkt sich deine Wahl beim nächsten Mal.

Die Buttons in der Kopfzeile:

- **Versionsnummer** (oben links, klein), welcher Build installiert
  ist.
- **DE / EN** (oben rechts), wechselt die Sprache des
  GM-Interfaces.
- **⚙ Einstellungen**: öffnet die Passwort-Tür. Ohne Passwort:
  Finger weg.

# Modus und Spiel wählen

::shot:m-02-game-select

Nach dem Tipp auf einen Standort landest du hier. Die Liste unten
zeigt die schon vorhandenen Spiele dieses Standorts (neueste zuerst)
mit ID, Datum, Status (wartet / spielt / beendet) und Team-Anzahl.
**Öffnen** springt direkt ins Dashboard, praktisch, wenn du
versehentlich weg-navigiert hast.

Ein neues Spiel anlegen:

1. **Modus** aus dem Dropdown wählen. Bestimmt Mission-Bibliothek,
   Regelwerk und Timer. "MiSSiONS" ist der Default; Admins können
   weitere angelegt haben (z.B. ADVANCED).
2. **+ Neues Spiel** tippen.

Die App legt das Spiel an, wählt die passende Mission-Mischung für
den Standort und zeigt einen **Dashboard öffnen →**-Knopf plus ein
QR-Code-Modal für die Spieler.

# Das Dashboard

::shot:m-03-dashboard

Deine Kommandozentrale für ein laufendes Spiel. Vier Bereiche:

- **Kopfzeile**: Spiel-ID, **Start/Pause-Timer**, QR / 🎬 /
  Zahnrad / Sprache oben rechts. Der 🎬-Knopf ist während des
  Spiels ausgegraut und wird nach Spielende freigeschaltet, siehe
  *Fotos und Videos des Spiels exportieren* weiter unten.
- **Team-Chips**: eine Kachel pro beigetretenem Team, mit
  Punktestand. Ein **🔔** auf einer Kachel bedeutet, das Team hat
  etwas Offenes, meistens eine Einreichung zur Prüfung.
- **Hauptbereich** (links), die Mission-Karten des gewählten Teams
  oder die Team-Liste, wenn keins ausgewählt ist.
- **Rechte Spalte**: Chat- und Broadcast-Tab. (Rail Adventure Spiele
  ergänzen hier einen dritten Karten-Tab, siehe Teil 2.)

Der Timer startet bei der konfigurierten Dauer (Default 60 Minuten).
**▶ Start** beginnt den Countdown. **⏸ Pause** stoppt die Uhr für
alle. Pause ist **nur für technische Probleme oder Notfälle**
gedacht (Server-Hänger, Netzwerk weg, Vorfall in der echten Welt),
nicht für gemütliche Pausen. **Neu starten** setzt den Timer
zurück auf voll.

# Einreichungen prüfen

::shot:m-04-team-detail

Tipp eine Team-Kachel, um das Team-Detail im Hauptbereich zu
öffnen. Jede Mission, die dem Team zugeteilt wurde, wird zu einer
Karte. Karten mit einem offenen Upload (wie "Fountain selfie" oben)
leuchten mit einem orangenen Rand und zeigen:

- Ein **Vorschau-Thumbnail** des Uploads.
- Einen **Annehmen** (✓) und einen **Ablehnen** (✗)-Knopf.
- Missionsname, Beschreibung und Aufgabe als Referenz.

**Annehmen** vergibt die Punkte. Das Team bekommt einen 👍-Toast und
ein grünes Häkchen auf seiner Mission-Karte.

**Ablehnen** weist zurück. Ein Dialog fragt nach dem Grund (siehe
unten).

## Bild vergrössern

::shot:m-05-lightbox

Tipp das Thumbnail an, um den Lightbox-Modus zu öffnen, das Bild
füllt den Bildschirm, damit du wirklich beurteilen kannst, ob das
Team die Aufgabe erfüllt hat. Zwei Knöpfe oben rechts:

- **↻ Drehen**: dreht das Bild 90° im Uhrzeigersinn pro Klick.
  Praktisch bei Hochformat-Fotos, die als Querformat gespeichert
  wurden, oder umgekehrt. Die Drehung gilt nur für deine Ansicht,
  die gespeicherte Datei wird nicht verändert.
- **✕**: schliesst die Lightbox. Auch ein Klick auf den dunklen
  Hintergrund schliesst.

::shot:m-06-lightbox-rot

Dasselbe Bild nach einem Klick auf **↻ Drehen**. Weiter tippen für
180°, 270°, zurück auf 0°. Wenn du entschieden hast, Lightbox
schliessen und Annehmen oder Ablehnen auf der Karte tippen.

Bei Videos zeigt die Lightbox einen Player statt eines Standbilds,
kein Drehen-Knopf, weil Video seine Orientierung in den Metadaten
trägt.

## Ablehnen

::shot:m-07-reject-modal

Wenn du **Ablehnen** tippst, öffnet sich dieser kleine Dialog. Tipp
einen kurzen Grund ein, **das Team sieht diesen Text** in seinem
Spieler-Chat, also sei ehrlich und konkret. Gute Beispiele: "Zu
dunkel, bitte am Laternenpfahl nochmal aufnehmen", "Falscher
Brunnen, versucht den vor der Kirche", "Halbes Team fehlt im Bild".

**Ablehnen & benachrichtigen** bestätigt. Das Team bekommt einen
👎-Toast, der Upload wird aus dem Speicher gelöscht, und die
Mission kann erneut hochgeladen werden.

Falsch hochgeladene Bilder (Selfie statt Mission, Chat-Foto)
erscheinen auch hier, einfach mit "falscher Upload" ablehnen.

# An alle senden (Broadcast)

::shot:m-08-broadcast

In der rechten Spalte auf **Broadcast** wechseln. Nachricht tippen,
**📢 An alle senden**. Jedes Team-Chat-Fenster bekommt die Nachricht
gleichzeitig, mit einem kleinen "Broadcast"-Tag, so wissen die
Spieler, dass es nicht persönlich an sie geht.

Wofür:

- "Noch 5 Minuten, zurück zum Treffpunkt!"
- "Kurzer Schauer, gerne unterstellen!"
- "Server-Hänger, Timer für zwei Minuten pausiert, sorry."

Einzel-Feedback gehört in den **Chat**-Tab; Broadcast nur für
Sachen, die jeden betreffen.

# Team-Chat

::shot:m-09-chat

Der Default-Tab in der rechten Spalte ist **Chat**, gekoppelt an
das im Hauptbereich gewählte Team. Nachricht tippen, Enter oder
**Senden**, das Team sieht sie sofort im Spieler-Chat.

Wenn ein Team schreibt, leuchtet auf seinem Tab ein oranger Punkt
auf. Wechsel zum schreibenden Team, lies, antworte. Der Punkt ist
pro Team, du kannst ungelesene Nachrichten von einem Team haben,
während du gerade beim Chat eines anderen Teams bist.

# Was ohne Passwort nicht geht

::shot:m-10-settings-gate

Das passiert, wenn du auf das **⚙**-Zahnrad tippst und das GM-
Passwort nicht hast. Alles dahinter ist Admin-Sache:

- Standorte oder Missionen hinzufügen/entfernen
- Regeln bearbeiten
- QR-Vorlage oder GM-Passwort ändern
- App updaten

Wenn dir eine Mission mit falschen Infos oder eine zu ändernde Regel
auffällt, notier sie und gib sie an die Person weiter, die eure
Installation betreut.

# Nichts zählt vor dem Start

Solange die Uhr nicht läuft, können Teams zwar alles ansehen, aber
**nichts abgeben**. Fotos, Videos, Antworten, Scans und Zeichnungen
werden mit dem Hinweis „Die Zeit hat noch nicht begonnen" abgelehnt.

Wenn ein Team meldet, sein Upload gehe nicht durch: zuerst die Uhr
prüfen. Das ist fast immer der Grund.

# Ablehnungen landen im Team-Chat

Deine Begründung erscheint zusätzlich **im Chat des Teams**, versehen
mit der Mission, um die es geht. Das ist im Betrieb wichtig: Die
Einblendung verschwindet nach ein paar Sekunden, und ein Team, das
gerade läuft oder filmt, verpasst sie oft. Im Chat bleibt sie lesbar —
und weil der Missionsname dabeisteht, weiss auch ein Team mit mehreren
Ablehnungen, welche gemeint war. Du musst dich nicht zusätzlich im
Chat wiederholen.

# Geführte Touren (🎓)

Der **🎓**-Knopf sitzt auf dem Startbildschirm und nochmals oben im
Dashboard. Er öffnet kurze geführte Touren, die dich Schritt für
Schritt durch die Oberfläche führen: Das erklärte Element wird
hervorgehoben, dazu ein kurzer Text.

Nutze sie, wenn du neu bist oder die GM-Rolle mitten in der Saison
übernimmst. Die Touren sind reine Rundgänge — du kannst jederzeit mit
**Schliessen** aussteigen, und nichts darin verändert ein echtes Spiel.

Eine Tour erklärt das Innere eines laufenden Spiels. Weil sie dafür ein
Team braucht, legt sie still ein **Demo-Team** an und **löscht es am
Ende wieder**. Brichst du mittendrin ab, kann das Demo-Team
zurückbleiben — es heisst „Demo" und lässt sich wie jedes andere mit
🗑 löschen.

Für die Touren brauchst du kein Einstellungs-Passwort.

# Der Update-Hinweis: was eine neue Version bringt

Gibt es eine neuere Version, begrüsst dich die App mit **⬆ Update
verfügbar**. Neben den Versionsnummern steht ein aufklappbarer Block
**Was ist neu in …**, der auflistet, was das Update enthält — sortiert
nach **Neu**, **Geändert** und **Behoben**, mit der Anzahl im Titel.

Klapp ihn auf, bevor du entscheidest. Das ist der Unterschied zwischen
„irgendein Update" und „das behebt genau das, was am Samstag genervt
hat". Das Einspielen selbst braucht das GM-Passwort, und die App
verweigert es, solange noch ein Spiel läuft oder wartet.

::part:2:Rail Adventure Spiele leiten

Rail Adventure teilt die Aufgaben eines Teams in zwei Arten:

- **Missionen** — überall lösbar, kein GPS nötig. Spieler sehen diese
  zuerst.
- **Checkpoints** — GPS-Ziele. Das Team läuft physisch hin und löst
  die Aufgabe innerhalb eines gesetzten Radius.

Spieler wechseln **immer ab**: eine Mission, dann ein Checkpoint, dann
eine Mission und so weiter. Wichtig: **Jede Aufgabe muss von dir
angenommen werden, bevor die nächste gemacht werden kann** — reicht
ein Team ein Foto für eine Mission ein, kann es den nächsten
Checkpoint zwar lesen, aber erst lösen, wenn du diese Mission
angenommen (oder abgelehnt) hast. Checkpoints bleiben gesperrt, bis
das Team eine Mission abgeschlossen hat, und umgekehrt.

Alles, was du von MiSSiONS kennst, gilt weiterhin — Dashboard,
Team-Chips, Chat, Broadcast, Freeze, Lightbox — aber das Spiel startet
anders und es gibt einen extra **Karten**-Tab.

> "Rail Adventure" ist beim Anlegen eines neuen Modus jetzt
> **standardmässig aktiv** (ein Schalter im Modus-Editor auf der
> Einstellungs-Seite). Ein Modus mit ausgeschaltetem Rail Adventure
> verhält sich wie eine einfache geordnete Liste ohne
> Missionen/Checkpoints-Aufteilung.

# Ein Rail Adventure Spiel starten

::shot:cr-01-landing

Tipp ganz unten am Startbildschirm auf die **Rail Adventure**-Kachel
statt eines normalen Standorts. Die Kachel zeigt ein Runner-Symbol
und darunter die Anzahl verfügbarer Rail Adventure Modi.

::shot:cr-02-game-select

Die Spielauswahl für Rail Adventure funktioniert wie die normale, aber
das Dropdown ist die **Rail Adventure Modus**-Auswahl (in dieser Demo
"Altstadt-Tour") statt der Modus-pro-Standort-Auswahl. Modus
wählen, **+ Neues Spiel** tippen, App erzeugt QR + Dashboard.

# Das Rail Adventure Dashboard

::shot:cr-03-dashboard

Layout identisch zu MiSSiONS, Team-Chips oben, Mission-Karten im
Hauptbereich bei Team-Auswahl, Chat / Broadcast / Karten-Panel
rechts. Die Chat- und Broadcast-Tabs funktionieren genau gleich wie
bei MiSSiONS.

Die Unterschiede stecken alle in den **Mission-Karten** und im
**🗺️-Karten**-Tab.

# Missionen eines Rail Adventure Teams

::shot:cr-04-team-detail

Jede Rail Adventure Mission-Karte sieht ähnlich aus wie eine MiSSiON-
Karte, mit ein paar Extras:

- Eine **Reihenfolgen-Nummer** links (`1`, `2`, `3`…),
  Rail Adventure Missionen sind sortiert, und Spieler schalten sie eine
  nach der anderen frei. Ein Team muss bei Mission 1 ankommen,
  bevor Mission 2 überhaupt sichtbar wird.
- Ein **⭐** vor **Sondermissionen**, die folgen nicht der
  Reihenfolge; Spieler können sie jederzeit aus einem separaten
  Bereich spielen.
- Ein **❔ Status**, wenn das Team noch nicht angekommen ist,
  ersetzt durch die echte Aufgabe und die Annehmen/Ablehnen-UI,
  sobald sie vor Ort sind und Medien oder eine Antwort eingereicht
  haben.

Annehmen, Ablehnen, Lightbox und Drehen funktionieren genau wie
bei MiSSiONS, siehe m-04 bis m-07 in Teil 1.

# Das Karten-Panel

::shot:cr-05-map

In der rechten Spalte auf **🗺️** wechseln, um die Live-Karte zu
sehen. Marker sind die Missionsziele, die Reihenfolge, in der sie
abgelaufen werden. Team-Positions-Punkte erscheinen, sobald die
Spieler ihre Standort-Freigabe im Spieler-View erteilt haben.

Sondermissionen erscheinen nicht auf der Karte, sie haben keinen
festen Ort.

Die Karte hat einen **Vollbild-Toggle** (oben rechts), der sie auf
den ganzen Hauptbereich aufzieht; nochmal tippen für zurück.
Vollbild verwenden, wenn du sehen willst, wo alle Teams gerade sind.

> Sondermissionen haben absichtlich kein GPS-Ziel. Wenn du eine
> ohne Koordinaten konfiguriert hast, wohnt sie im ⭐-Bereich des
> Spielers, nicht auf dieser Karte.

# Auf-Foto-erwischtes Team einfrieren (nur Rail Adventure)

::shot:cr-06-freeze

Der **❄ Freeze**-Knopf ist eine Rail Adventure exklusive PvP-Mechanik
rund um das Erwischtwerden auf einem Foto. Der Ablauf:

1. Team A entdeckt Team B irgendwo auf der Route und macht ein
   Foto von ihnen.
2. Team A reicht dieses Foto bei dir ein (als Missions-Upload oder
   per Chat, je nach Setup).
3. Du prüfst, dass Team B tatsächlich auf dem Foto zu sehen ist,
   und nimmst die Einreichung an.
4. Du öffnest das Team-Detail von **Team A** (dem Fotograf, der
   Freezer) und tippst auf **❄ Freeze**. Im Modal wählst du
   **Team B** als Ziel und eine Dauer (1, 3, 5 oder 10 Minuten),
   dann bestätigen.

Das gerade im Hauptbereich gewählte Team ist immer der
**Freezer**; das Modal wählt dann das **andere** Team, das
eingefroren wird. Nicht verwechseln: würdest du das Detail von
Team B öffnen, wäre Team B der Freezer, also das Gegenteil von
dem, was du willst.

Während eingefroren sieht Team B ein "Du bist eingefroren, der GM
taut dich in N Minuten auf"-Overlay; Timer steht still, Uploads
und Karten-Ankünfte sind blockiert. Team A hat seinen einen
Freeze-Schuss gegen Team B verbraucht (siehe unten).

Das ist die **einzige** legitime Verwendung des Freeze-Knopfs.
Nicht als neutrale Pause, nicht als allgemeine Strafe und nicht,
um einem Team eine Auszeit zu geben, einsetzen.

Warum nur Rail Adventure? In MiSSiONS-Spielen arbeitet jedes Team seine
eigene Liste an einem Standort ab, da gibt es nichts gegenseitig
zu erwischen. Rail Adventure Teams teilen sich eine Route, deshalb gibt
es die Foto-Mechanik überhaupt.

Zur Erinnerung an die Richtung des Modals: Du öffnest es aus dem
Team-Detail des Freezers (Team A in der Geschichte oben). Das
Modal fragt dann, welches andere Team eingefroren werden soll
(Team B). Das Team, dessen Detail du gerade ansiehst, wird nie
eingefroren. **Einfrieren** tippen zum Bestätigen. Teams tauen
automatisch auf, wenn die Zeit um ist, oder du tippst
**Auftauen** (🔥) für ein vorzeitiges Auftauen.

Jedes Team kann jeden Rivalen **einmal pro Paar** einfrieren: der
Picker greift Rivalen aus, gegen die der Freezer seinen Schuss
schon verbraucht hat. Eine Einmal-Waffe pro Paar, keine
Dauerstörung.

---

## Checkliste zum Spielende (beide Modi)

Wenn der Timer auf null geht (oder du vorzeitig **Spiel beenden**
tippst), passiert Folgendes:

- Die End-of-Game-Nachricht erscheint bei allen Spielern.
- Die Rangliste / das Ranking friert ein.
- Das Spiel wird im Dashboard als "beendet" markiert.

Vor dem Weggehen:

1. **Rangliste** abfotografieren (rechte Spalte), praktisch für
   die Siegerehrung, falls die Spieler ihre Punkte nicht im Kopf
   haben.
2. Offene Einreichungen entweder annehmen oder ablehnen, nicht
   hängen lassen.
3. Bei Bad-Faith-Uploads (Off-Topic, Unangemessenes) **Ablehnen**
   mit Grund, der Upload wird auch aus dem Speicher entfernt.

Du kannst das Dashboard offen lassen und später zurückkommen,
beendete Spiele bleiben in der Liste unter ihrem Standort (oder
unter Rail Adventure).

---

## Fotos und Videos des Spiels exportieren

Sobald das Spiel beendet ist, leuchtet das **🎬**-Symbol oben rechts
im Dashboard auf. Klick darauf für das Export-Panel:

- **📦 ZIP herunterladen (alle Medien)**: streamt alle angenommenen
  Fotos und Videos aller Teams direkt in deinen Browser als
  `missions-<spiel-id>.zip`. Im Archiv hat jedes Team einen eigenen
  Ordner mit dem Team-Selfie und allen freigegebenen Einreichungen,
  benannt in Annahme-Reihenfolge. Das ist die Archiv-Lieferung,
  geht an den Kunden oder ins eigene Backup.
- **🎬 Foto-Collage rendern**: startet einen serverseitigen Render
  einer einzelnen MP4-Diashow. Jedes Team bekommt eine Titel-Karte
  mit seinem Namen, danach folgen die angenommenen Fotos in
  Reihenfolge (ca. zwei Sekunden pro Foto). Videos sind **nicht**
  in der Collage, nur im ZIP, weil Team-Videos für eine Diashow
  neu zu encodieren den Render stark verlängern würde. Ein
  Fortschrittsbalken zeigt den Render-Status; wenn fertig, lädt die
  MP4 automatisch herunter.

Ein paar Hinweise aus der Praxis:

- Der Render läuft auf dem Server. Du kannst das Modal nach dem
  Start schliessen; beim erneuten Öffnen läuft die Anzeige weiter,
  falls der Render noch nicht fertig ist.
- Ein typisches Spiel mit 30–40 angenommenen Fotos rendert in
  30–60 Sekunden.
- Der Export erfasst **angenommene** Medien. Abgelehnte Uploads
  werden im Moment der Ablehnung schon aus dem Speicher gelöscht
  und können hier nicht wieder auftauchen.
- Erneutes Rendern überschreibt die vorige Collage. Das ZIP wird
  bei jedem Download frisch erzeugt.

---

## Häufige Fragen

**Ein Team sagt, sie hätten ein Video hochgeladen, aber nichts ist
sichtbar.**
Schau im Team-Detail nach, manchmal scheitert ein Video-Upload
still wegen schlechter Verbindung. Lass sie aus der Mission-Karte
erneut hochladen.

**Auf dem Handy des Teams steht "eingefroren", aber ich habe sie
nie eingefroren.**
Vielleicht hat ein Teammitglied einen Auto-Freeze ausgelöst (z.B.
doppeltes Einreichen kurz hintereinander). Das Dashboard zeigt den
aktiven Freeze und einen 🔥-Knopf zum Auftauen.

**Ein Team ist dem falschen Spiel beigetreten.**
Jedes Spiel hat seine eigene Beitritts-URL/QR. Wenn du den falschen
Code rausgegeben hast, beende das Spiel (oder ignoriere es) und
lass sie dem richtigen beitreten. Migrieren geht nicht, sie fangen
neu an.

**Ein Rail Adventure Team sieht die nächste Mission nicht.**
Sie sind wahrscheinlich physisch noch nicht innerhalb des Radius
des aktuellen Ziels. Schau im Karten-Panel nach, der Team-Punkt
sollte im Ziel-Kreis liegen. Falls ja und die Mission trotzdem
nicht freigeschaltet ist, ist ihre Standort-Genauigkeit zu
schlecht; lass sie ins Freie treten und ein paar Sekunden warten.

**Spieler sagen, sie sehen Missionen nicht in ihrer Sprache.**
Jeder Spieler wählt seine Sprache auf dem Beitritts-Bildschirm.
Wenn sie falsch ist, tippen sie das 🌐 in ihrer Spieler-App, nicht
im GM-Dashboard.

**Kann ich zwei Spiele am gleichen Standort gleichzeitig laufen
lassen?**
Ja, jedes Dashboard ist unabhängig. Achte nur darauf, dass jedes
Team die richtige Spiel-ID joint.

# Karten, die dich nie erreichen

Manche Missionstypen entscheidet die App selbst — sie werden auf der
Karte einfach grün, ohne Prüfschritt:

- **Quiz** — das Team tippt eine Antwort. Die App vergleicht sie mit
  allen hinterlegten Schreibweisen in jeder Sprache und vergibt die
  Punkte selbst.
- **📷 Scan** — das Team hält die Kamera auf einen QR-Code oder ein
  gedrucktes Bild. Ein Scan kann die Mission abschliessen, eine
  versteckte Aufgabe aufdecken oder eines von mehreren Fragmenten
  einsammeln.
- **🧩 Puzzle** — Lösen schliesst die Mission ab.

Dass hier nichts zu prüfen ist, ist gewollt: Es gibt keinen Upload zu
beurteilen. Besteht ein Team darauf, gelöst zu haben, ohne dass sich
die Karte bewegt, liegt es meist an der Uhr — oder bei einem Scan an
einem beschädigten Code oder einem aus einem anderen Spiel.

# Was die Karte zeigt

Die Marker sind **nach Zustand eingefärbt** statt nummeriert: grün für
erledigt, orange für „wartet auf deine Freigabe", neutral für offen.
So liest du die Lage auf einen Blick.

Nummern gibt es bewusst nicht mehr. Durch den Wechsel zwischen
Missionen und Checkpoints laufen Teams keine feste Reihenfolge — eine
Nummer hätte eine Ordnung suggeriert, die es nicht gibt.

Ein eingefrorenes Team trägt einen **❄-Marker**, du siehst also ohne
Kartenklick, wer gerade aussetzt.
