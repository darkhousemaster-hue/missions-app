---
title: "MiSSiONS Einstellungs-Handbuch"
subtitle: "Für Administratoren mit dem GM-Passwort"
lang: de
manifest: settings-de
---

# Willkommen

Dieses Handbuch beschreibt jeden Bildschirm hinter der
**Einstellungen**-Tür. Es ist in drei Teile gegliedert:

- **Teil 1, Verwaltung.** Was nicht spielspezifisch ist: Passwort-
  Tür, öffentliche URL, Sicherheit, Updates, QR-Druckvorlage.
- **Teil 2, MiSSiONS-Konfiguration.** Standorte, Modi, Missionen,
  und die Regeln, die Spieler im Spiel sehen. Das ist der
  Hauptbereich für die tägliche Pflege.
- **Teil 3, Rail Adventure Konfiguration.** Ein separater Spieltyp mit
  eigenen Modi, GPS-Zielen, Hinweis-Sequenzen und Sondermissionen.

Rail Adventure ist bewusst getrennt, es teilt die Einstellungs-Hülle, hat
aber eigene Logik (GPS-Ziele, Hinweis-Folgen, Sondermissionen), die
für MiSSiONS-Spiele nicht gilt. Wenn du immer nur einen der beiden
Typen verwendest, kannst du den anderen Teil überspringen.

Das Passwort für die Einstellungen hat, wer die App installiert
hat. Gib es sparsam weiter, denn damit lässt sich jede Regel, jede
Mission und das Passwort selbst ändern. Default nach frischer
Installation: `admin1898`. Auf dem Sicherheit-Tab so schnell wie
möglich ändern.

> Die Screenshots wurden auf einer frischen Demo-Datenbank erstellt
> mit drei Standorten (Altstadt, Stadtpark, Hauptbahnhof), sechs
> MiSSiONS und einem Rail Adventure Modus mit drei Missionen. Deine echte
> Installation sieht genauso aus, zeigt aber deine eigenen Daten.

::part:1:Verwaltung

# Die Passwort-Tür

::shot:adm-01-gate

Tipp oben rechts auf das Zahnrad. Du landest auf der Passwort-Tür
oben. Tipp das GM-Passwort und drück **Entsperren** (oder Enter).
Falsches Passwort? Das Feld wackelt, ein roter Fehler erscheint
darunter. Mit **Zurück** zurück zum Startbildschirm.

Jeder Einstellungs-Tab liegt hinter dieser Tür, wem du nicht
vollständig vertraust, der sollte das Passwort nicht haben.

# Allgemein

::shot:adm-02-general

**Öffentliche URL.** Die Adresse, unter der die Spieler dein Spiel
erreichen. Wenn du `start-tunnel-windows.bat` ausführst, druckt der
mitgelieferte Cloudflare-Tunnel eine URL wie
`https://abc-def-ghi.trycloudflare.com`. Klick **Erkennen** und die
App liest sie automatisch aus. Du kannst sie auch von Hand eintragen.

**Nachricht am Spielende.** Wenn der Timer eines Spiels abläuft,
sehen alle Spieler diese Nachricht. Tipp sie in jeder Sprache ein,
der **🌐 Auto**-Knopf füllt die leeren Sprachen aus der ersten
ausgefüllten heraus. Vor dem Verlassen des Tabs **Speichern** drücken.

# Sicherheit

::shot:adm-03-security

GM-Passwort ändern. Aktuelles Passwort eingeben, neues zweimal. Das
neue Passwort gilt sofort und auf allen Geräten, sorge vorher dafür,
dass du es deinem Team mitteilen kannst.

# Updates

::shot:adm-04-updates

Die App kann sich direkt von GitHub aktualisieren. Setz die
**GitHub-Repository-URL** einmalig (z.B.
`https://github.com/du/missions-app`); das **Version**-Feld zeigt die
installierte Version. Mit **Jetzt aktualisieren** läuft
`git pull && npm install --production`, und die App startet sich neu.
Die Ausgabe erscheint im Feld darunter.

**Vorsicht während laufender Spiele**, der Neustart trennt kurz die
Verbindung zu allen Spielern. Sie verbinden sich automatisch wieder,
aber das ist trotzdem störend. Updates lieber zwischen Sessions.

# QR-Vorlage

::shot:adm-05-template

Für Standorte, an denen du physische Zugangskarten druckst
(gefalteter Bogen mit Branding und QR-Code), lade hier dein Template
als PNG hoch und zieh den orangenen QR-Marker an die Position, wo der
Code landen soll. Wähle vorher das Papierformat (Default A4).
**Position speichern** sichert den Marker; **Vorlage löschen**
entfernt das Upload. Wenn ein GM ein neues Spiel anlegt, wird der
QR-Code an der gespeicherten Position in die Vorlage gerendert.

# Statistiken

Der Reiter **Statistiken** beantwortet, was tatsächlich gespielt wurde
und wie oft: abgeschlossene Spiele pro Standort, pro Modus und pro
Rail-Adventure-Route. So siehst du, welche Inhalte sich lohnen und
welche nie gewählt werden.

Gezählt wird ein Spiel, wenn es wirklich gespielt wurde. Spiele, die du
unfertig aus der Liste löschst, fallen wieder heraus — ein vertipptes
Testspiel verzerrt das Bild also nicht.

# Automatische Nachrichten

Statt jeder Gruppe im richtigen Moment von Hand zu schreiben, kannst du
hier **zeitgesteuerte Rundnachrichten** vorbereiten. Jeder Eintrag hat
einen Zeitpunkt (Minuten nach Spielstart oder Minuten vor Schluss) und
den Text. Erreicht ein Spiel diesen Punkt, geht die Nachricht von
selbst an alle Teams.

Schreibe den Text **in allen Sprachen, in denen ihr spielt** — jedes
Gerät bekommt die Fassung seiner gewählten Sprache. Typisch: eine
Halbzeit-Erinnerung, ein „noch 15 Minuten, macht euch auf den Rückweg"
oder der Treffpunkt zum Schluss.

# Farbschemata

Unter **Farbschema** gestaltest du die Spieler-App komplett um:
Hintergrund, Karten, Buttons, Akzente, Texte und Hinweise, dazu ein
eigenes Logo. Die Einstellungen gelten **pro Standort** und **pro
Rail-Adventure-Route** — zwei Standorte dürfen also völlig
verschieden aussehen.

Zwei Dinge machen das praktikabel statt frickelig:

- **Live-Vorschau.** Neben den Feldern stehen Handy-Vorschauen, die
  sich sofort mitverändern. Eigene Vorschauen gibt es für die
  Missionsliste, eine geöffnete Mission, den Chat und eine Ablehnung —
  du prüfst also die Zustände, die Spieler wirklich sehen.
- **Zeigen statt suchen.** Fährst du über eine Einstellung, umrandet
  die Vorschau das Element, das sie einfärbt; fährst du über die
  Vorschau, nennt sie die zuständige Einstellung. Ein Klick hält die
  Markierung fest.

Ein zweiter Reiter schaltet auf das **Gamemaster-Dashboard**, das ein
eigenes Schema hat. Es betrifft **nur** das Dashboard — der Rest der
Verwaltung behält bewusst sein normales Aussehen, damit sich beide
nicht gegenseitig verstellen.

> Ändere nur, was du ändern willst. Jeder Wert hat ein
> „Zurücksetzen", und es gibt eines für das ganze Schema — du kommst
> also immer zum Standard zurück.

::part:2:MiSSiONS-Konfiguration

# Standorte

::shot:m-01-locations

Ein **Standort** ist ein physischer Ort, an dem Spiele stattfinden.
Die Demo enthält drei: Altstadt, Stadtpark, Hauptbahnhof. Jeder
Standort hat eine eigene Mission-Bibliothek, wenn ein GM ein Spiel
"in der Altstadt" startet, bekommen die Spieler die
Altstadt-Missionen plus alle **Pool**-Missionen.

Mit **+ Standort** (oben in der Liste) legst du einen neuen an. Mit
**Bearbeiten** auf einer Karte änderst du Name oder Regeln.
**Löschen** entfernt den Standort und **alle Missionen darin**, gut
aufpassen.

::shot:m-02-locations-add

Der Standort-Anlegen-Dialog:

- **Name**: was der GM sieht.
- **Min. Standort-MiSSiONS**: beim Spielstart garantiert die Engine
  diese Anzahl Missionen aus diesem Standort (Rest aus dem Pool). So
  fühlen sich Spiele immer ortspassend an.
- **Foto / Video / Indoor erlauben**: welche Mission-Typen aus
  diesem Standort gezogen werden dürfen. "Indoor" aus ist sinnvoll
  für Standorte mit zuverlässigem Wetter und draussen-spielen-Wunsch.

# Modi und Mission-Bibliothek

::shot:m-03-missions

Die Mission-Bibliothek ist nach **Modus** (Leiste oben) und
**Standort** (Dropdown) gegliedert. Eine Mission gehört zu genau
einem Modus und entweder zu einem Standort oder zum globalen Pool.

**Modus-Tabs.** Jeder Modus ist eine eigene Bibliothek mit eigenem
Regelwerk und Timer. Mit **+ Modus** legst du einen weiteren an. ✎
öffnet die Bearbeitung. Der erste Modus ("MiSSiONS", id 1) kann
nicht gelöscht werden, das ist der Sicherheits-Default.

**Standort-Filter.** "Alle" zeigt alles im aktuellen Modus; ein
Standort filtert auf dessen Missionen; **Pool** zeigt nur
modus-weite Missionen ohne Standort.

**Massenaktionen.** Hake Checkboxen einzelner Missionen an, es
erscheint die Werkzeugleiste: **Kopieren nach Modus…** oder
**Export**. Der **⬆ Import** liest eine JSON-Datei im Export-Format.

::shot:m-04-mission-add

Jede Mission hat fünf Sprachfelder für Name, Beschreibung, Aufgabe.
Tipp nicht alle fünf von Hand, schreib eine Sprache vollständig und
drück **🌐 Auto** über den Namensfeldern, um die anderen automatisch
füllen zu lassen. Hinterher nachschleifen, falls nötig.

- **Standort**: beschränkt die Mission (oder Pool für alle).
- **Modus**: meistens vorausgewählt auf den gerade gewählten.
- **Medientyp**: Foto oder Video. Spieler sind im Spiel auf das
  Format festgelegt.
- **Punkte**: wie viele Punkte das Team bekommt, wenn du freigibst.
  Verspätungs-Penaltys werden abgezogen.
- **Auch drinnen möglich**: anhaken für Schlechtwetter-Backup.
  Standorte ohne "Indoor erlaubt" überspringen solche Missionen.

Die **Beschreibung**- und **Aufgabe**-Tabs:

- **Beschreibung** ist die Story/der Kontext, oberhalb des
  Kamera-Knopfs.
- **Aufgabe** ist die explizite "tu das"-Anweisung, kurz halten.

**Speichern**, die Mission erscheint sofort in der Liste.

# Regeln

::shot:m-05-rules

Ein **Regelwerk** ist eine Liste von Regeln, die im Spiel im Regeln-
Modal angezeigt wird. Das Standard-Regelwerk kann nicht gelöscht
werden, du kannst weitere anlegen (z.B. eine familienfreundliche
Variante) und verschiedenen Modi unterschiedliche Regelwerke
zuordnen.

In den Regel-Zeilen kannst du die Platzhalter `[photo]`, `[video]`,
`[indoor]` verwenden, sie werden im Spieler-View zu kleinen Icons.
Zieh Regeln hoch/runter zum Sortieren; 🌐 übersetzt automatisch; ⎘
kopiert eine Regel in ein anderes Regelwerk. **Speichern** nicht
vergessen, ungespeicherte Änderungen werden hervorgehoben.

# Eigene Sprachen pro Standort

Über die fünf eingebauten Sprachen hinaus kann ein Standort **eigene
Sprachen** anbieten — einen Dialekt oder eine Sprache eurer Gäste, die
die App nicht mitbringt. Am Standort hinzufügen, Name und
**Basissprache** vergeben, und sie erscheint als weitere Pille in den
Sprachleisten des Missions-Editors.

Den Missionstext schreibst du dann selbst in dieser Sprache. Die
Beschriftungen der App (Knöpfe, Hinweise) greifen auf die Basissprache
zurück, denn die werden nicht automatisch übersetzt.

# Einen Modus auf einen Standort beschränken

Standardmässig erscheint jeder Modus im Auswahlfeld jedes Standorts.
Sobald jeder Standort eigene Modi hat, wird das unübersichtlich — und
der falsche Modus erzeugt ein leeres Spiel, weil die Missionen zu
einem anderen Standort gehören.

Jeder Modus hat deshalb die Einstellung **Verfügbar an**:

- **Alle Standorte** (Standard) — verhält sich wie bisher.
- **Ein bestimmter Standort** — der Modus erscheint nur noch im
  Auswahlfeld dieses Standorts.

Der Standardmodus bleibt unbeschränkt, damit jeder Standort immer
mindestens einen Modus zur Auswahl hat.

::part:3:Rail Adventure Konfiguration

Rail Adventure ist ein separater Spieltyp. Spieler laufen physisch zu
Karten-Markern, kommen am Ziel an und lösen dort eine Aufgabe. Das
Rail Adventure Settings-Panel ist wie der MiSSiONS-Tab aufgebaut, hat aber
pro Mission Extra-Felder für Koordinaten, Hinweis-Sequenzen und
Sondermissionen. Hier konfigurierte Modi und Missionen erscheinen
**nur** in Rail Adventure Spielen, nicht in MiSSiONS-Spielen, und
umgekehrt.

# Rail Adventure Modi

::shot:cr-01-modes-empty

Der Rail Adventure Tab funktioniert wie der MiSSiONS-Tab: Eine Reihe
Modus-Tabs oben, darunter die Missionen des aktiven Modus. Mit
**+ Modus** ganz rechts in der Modus-Leiste legst du einen neuen an.

::shot:cr-02-mode-add

Ein Rail Adventure Modus hat:

- **Name**: was der GM aus dem Dropdown wählt.
- **Regelwerk**: dieselbe Auswahl wie bei MiSSiONS; gilt für die
  Spiele dieses Modus.
- **Erlaubte Medien**: Foto, Video oder beides. Bestimmt, welche
  Medien-Missionen in diesem Modus erlaubt sind.
- **Standard-Dauer (Minuten)**: der Default-Timer für ein Spiel.

# Rail Adventure Missionen

::shot:cr-03-mission-add

Eine Rail Adventure Mission hat alle Felder einer MiSSiON plus die
ortsabhängigen Extras:

- **GPS-Koordinaten + Radius**: wo das Ziel liegt und wie nah
  (Meter) die Spieler ran müssen, bevor die Aufgabe freigeschaltet
  wird. Kleinen Radius (15–25 m) in dichten Stadtgebieten; grösseren
  (40–60 m) in offenen Parks.
- **Auf Karte anzeigen**: ob das Ziel-Symbol für die Spieler
  sichtbar ist. Aus für "find den Weg nur mit Hinweisen"-Missionen.
- **GPS-Hinweise**: werden eins nach dem anderen während des Wegs
  enthüllt; nützlich, wenn der Marker versteckt ist oder das Gebiet
  gross.
- **Aufgaben-Hinweise**: werden nach Ankunft enthüllt, wenn Teams
  an der Aufgabe selbst hängen.
- **Medium erforderlich**: Foto oder Video; nicht zusammen mit dem
  Antwort-Feld unten.
- **Mit Zeitlimit**: beim Tap auf "Start" beginnt ein Countdown.
  Penaltys greifen beim Überschreiten; Intervall und Punkte direkt
  darunter konfigurieren.

## Antwort-Missionen

::shot:cr-04-mission-answer

**Hat Antwort** anhaken, um die Mission zu einer "tipp das richtige
Wort"-Aufgabe zu machen. Das **Antwort(en)**-Feld nimmt eine
`|`-getrennte Liste, ignoriert Gross/Klein und Leerzeichen, also
treffen `Eule|Owl|Hibou|Civetta` alle. Schliesst Foto/Video aus,
ein Modus pro Mission.

## Sondermissionen

::shot:cr-05-mission-special

**Sondermission** anhaken, um die Mission aus der linearen
Reihenfolge zu nehmen. Sondermissionen:

- Erscheinen im ⭐-Bereich des Spielers, jederzeit spielbar, in
  beliebiger Reihenfolge.
- Überspringen den GPS-Ankunfts-Schritt komplett, auch wenn
  Koordinaten gesetzt sind.
- Nutzen die **Cooldown** (Minuten) für Wiederholungs-Limits: `0` =
  jedes Team kann sie nur einmal spielen; `5` = fünf Minuten
  zwischen Versuchen. Eine GM-Ablehnung setzt den Cooldown sofort
  zurück.

**Speichern** nicht vergessen. Spieler, die schon ein Spiel
gestartet haben, sehen mittendrin neu hinzugefügte Missionen nicht
vorher ausrollen.

---

## Tipps für den Alltag

- **Auto-übersetzen** sowohl bei MiSSiONS als auch Rail Adventure
  grosszügig nutzen, alle fünf Sprachen von Hand korrekt halten
  ist mühsam, die KI ist meistens gut genug.
- **Pool-Missionen** (nur MiSSiONS) sind **Füller**, kein
  Schlechtwetter-Backup. Sie sind ebenfalls Outdoor-Missionen, der
  Unterschied ist, dass sie keinem konkreten Standort zugeordnet
  sind, sodass die Engine sie in jedes Spiel reinziehen kann, um
  einen Modus mit zu wenigen standortspezifischen Missionen
  aufzufüllen. Für Schlechtwetter benutzt du den **Auch drinnen
  möglich**-Schalter pro Mission, das ist eine andere Eigenschaft
  als Pool.
- Bei Rail Adventure **den Radius zu Fuss testen**, GPS in einer Stadt ist
  selten besser als ±10 m, und ein zu enger Radius lässt Teams
  hängen.
- **Exportiere** Missionen ab und zu als Backup. Klein,
  menschenlesbar, nach DB-Wipe einfach re-importieren.
- **Nie während einer Session updaten.** Funktioniert, aber peinlich.

# Scan-Missionen (QR und Bild)

Eine **Scan**-Mission wird mit der Kamera gelöst statt mit der
Tastatur. Wähle **QR** (ein Code, den du ausdruckst und platzierst)
oder **Bild** (ein gedrucktes Motiv, das die Kamera erkennt), und dann,
was der Scan bewirkt:

- **Lösen** — der Scan schliesst die Mission ab.
- **Aufdecken** — der Scan enthüllt die eigentliche Aufgabe, die bis
  dahin verborgen bleibt. Gut für ein Rätsel, dessen Text vorher nicht
  lesbar sein soll.
- **Fragmente** — mehrere Codes gehören zusammen; die Mission ist
  fertig, wenn das Team alle gesammelt hat.

Bei QR zeigt der Editor den druckbaren Code sofort an — drucken,
laminieren, platzieren. Als Rückfalloption können Spieler den Code auch
eintippen, falls eine Kamera streikt.

> Ein Code aus einem anderen Spiel wird nicht angenommen. Meldet ein
> Team, sein Scan bewirke nichts, prüfe zuerst, ob der Ausdruck zur
> gespielten Route gehört.

# Quiz-Lösungen: mehrere Schreibweisen und Gross-/Kleinschreibung

Eine Antwort-Mission akzeptiert **eine Liste von Lösungen, nicht nur
eine**. Schreibweise eintippen, Enter oder **＋ Hinzufügen** drücken —
fertig ist eine Pille. Jede Pille gilt als richtig, du kannst also
„Zum grauen Fuchs", „grauer Fuchs" und „Fuchs" alle drei akzeptieren.

Text, der noch im Eingabefeld steht und nicht hinzugefügt wurde, ist
**rot markiert** und wird nicht gespeichert — mit Enter oder ＋
übernehmen oder leeren.

Die Eingabe muss **vollständig** übereinstimmen. Ein Bruchstück gilt
nicht; das ist Absicht, denn früher liess eine zu grosszügige Prüfung
schon einen einzelnen richtigen Buchstaben durch.

Für die **Gross-/Kleinschreibung** gibt es einen eigenen Schalter:

- **Aus** (Standard) — „fuchs" und „Fuchs" gelten beide.
- **An** — die Schreibweise muss exakt stimmen; deshalb kannst du
  unterschiedlich geschriebene Varianten einzeln auflisten.

Leerzeichen spielen nie eine Rolle, führende und schliessende werden
ignoriert. Akzente und Satzzeichen werden dagegen so verglichen, wie
sie eingegeben wurden: Wenn Gäste „Zurich" statt „Zürich" schreiben
könnten, nimm diese Schreibweise als eigene Pille auf.

🌐 **Auto** übersetzt nur die **erste** Lösung in die leeren Sprachen.
Weitere Varianten dort fügst du selbst hinzu.
