---
title: "Manuale del Gamemaster MiSSiONS"
subtitle: "Per gli operatori che gestiscono partite in diretta"
lang: it
manifest: gm-it
---

# Benvenuto, Gamemaster

Questo manuale è per te se **gestisci partite in diretta**:
accogli le squadre, consegni i codici di accesso, approvi le foto
e i video, invii broadcast quando serve l’attenzione di tutti,
congeli le squadre prese in foto e chiudi la partita allo scadere
del tempo.

È diviso in due parti perché l’app supporta due tipi distinti di
partita:

- **Parte 1, partite MiSSiONS.** La modalità classica: avvii una
  partita in un luogo fisico, i giocatori entrano, percorrono una
  lista curata di missioni foto/video e tu approvi gli invii.
- **Parte 2, partite Rail Adventure.** Una modalità GPS in cui i
  giocatori camminano fisicamente verso marker su una mappa,
  arrivano a ogni bersaglio e completano il compito sul posto. Il
  dashboard è simile ma aggiunge mappa, segnali di arrivo GPS e
  missioni speciali.

Se gestisci solo uno dei due, puoi saltare l’altra parte: non si
sovrappongono e ogni partita resta nella sua modalità.

**Non** ti serve la password delle impostazioni per nulla di tutto
questo. Tutto ciò che è in questo manuale funziona senza. Se sullo
schermo serve un admin per qualcosa, il manuale lo dirà; il tuo
ruolo è gestire, non configurare.

> Le schermate mostrano una partita demo con due squadre
> («Team Rot» / «Team Grün» per MiSSiONS; «Team Blau» / «Team
> Gelb» per Rail Adventure). Le tue partite reali avranno lo stesso
> aspetto con i tuoi nomi squadra e missioni.

::part:1:Gestire partite MiSSiONS

# La schermata iniziale

::shot:m-01-landing

Qui inizia ogni sessione. Vedi una tessera per posizione più una
tessera Rail Adventure in basso. Tocca la posizione dove gioca il tuo
gruppo; l’app ricorda la scelta per la prossima volta.

I pulsanti dell’intestazione:

- **Versione** (in alto a sinistra, piccolo): quale build dell’app
  è installata.
- **DE / EN / FR / IT / ES** (in alto a destra): cicla la lingua
  dell’interfaccia GM.
- **⚙ Impostazioni**: apre la porta password. Se non hai la
  password, lascia stare.

# Scegliere una modalità e avviare una partita

::shot:m-02-game-select

Toccare una posizione ti porta qui. La lista in basso mostra le
partite già create lì (la più recente in cima), ciascuna con il
suo ID, data di creazione, stato (in attesa / in corso /
terminata) e quante squadre sono entrate. Tocca **Apri** su una
qualsiasi per saltare nel suo dashboard; utile se sei uscito per
sbaglio.

Per avviare una nuova partita:

1. Scegli una **modalità** dal menu a discesa. La modalità decide
   quale libreria missioni, insieme regole e timer usare. «MiSSiONS»
   è la predefinita; gli admin possono averne aggiunte altre (es.
   ADVANCED).
2. Tocca **+ Nuova partita**.

L’app crea la partita, sceglie il giusto mix di missioni per la
posizione e ti mostra un pulsante **Apri dashboard →** più una
finestra QR code che puoi mostrare o stampare per far entrare i
giocatori.

# Il dashboard

::shot:m-03-dashboard

Il tuo centro di comando per una partita in corso. Quattro aree:

- **Barra superiore**: ID partita, **timer start/pause** e le
  icone QR / 🎬 / ingranaggio / lingua a destra. Il pulsante 🎬
  è grigio durante il gioco e si illumina a fine partita, vedi
  *Esportare le foto e i video della partita* più sotto.
- **Chip squadra**: uno per squadra entrata, con il punteggio
  corrente. Una **🔔** su un chip significa che c’è qualcosa in
  sospeso per quella squadra, di solito un invio da revisionare.
- **Area principale** (sinistra): le schede missione della squadra
  selezionata, o l’elenco squadre se nessuna è selezionata.
- **Pannello destro**: schede Chat e Broadcast. (Le partite
  Rail Adventure aggiungono una terza scheda mappa qui, vedi Parte 2.)

Il timer parte dalla durata configurata (60 minuti di default).
Tocca **▶ Avvia** per iniziare il conto alla rovescia. Tocca
**⏸ Pausa** per fermare l’orologio per tutti. La pausa è per
**difficoltà tecniche o emergenze soltanto** (problema server,
rete persa, incidente reale); non usarla per pause casual.
**Ricomincia** riporta il timer al massimo.

# Revisionare gli invii di una squadra

::shot:m-04-team-detail

Tocca un chip squadra per aprire il suo dettaglio nell’area
principale. Ogni missione assegnata diventa una scheda. Le schede
con un invio in attesa (come «Fountain selfie» sopra) si
illuminano con un bordo arancione e mostrano:

- Una **miniatura** di ciò che la squadra ha caricato.
- Un pulsante **Accetta** (✓) e un **Rifiuta** (✗).
- Il nome, la descrizione e il compito della missione come
  riferimento.

Tocca **Accetta** per assegnare i punti. La squadra riceve un
toast 👍 e una spunta verde sulla sua copia della missione.

Tocca **Rifiuta** per rifiutare. Una finestra chiede il motivo
(descritto subito).

## Ingrandire un’immagine

::shot:m-05-lightbox

Tocca la miniatura stessa per aprire la lightbox; l’immagine
riempie lo schermo così puoi giudicare davvero se la squadra ha
fatto il compito. Due controlli fluttuano in alto a destra:

- **↻ Ruota**: ruota l’immagine di 90° in senso orario per clic.
  Utile per foto scattate in verticale ma salvate in orizzontale,
  o viceversa. La rotazione riguarda solo ciò che vedi, non
  modifica il file salvato.
- **✕**: chiude la lightbox. Puoi anche toccare lo sfondo scuro.

::shot:m-06-lightbox-rot

La stessa foto dopo un clic su **↻ Ruota**. Continua a toccare per
ruotare ancora (180°, 270°, ritorno a 0°). Una volta deciso,
chiudi la lightbox e usa Accetta o Rifiuta sulla scheda.

Per i video, la lightbox mostra un lettore invece di un’immagine
fissa; non serve il pulsante di rotazione perché il video porta
con sé i propri metadati di orientamento.

## Rifiutare

::shot:m-07-reject-modal

Se tocchi **Rifiuta**, si apre questa piccola finestra. Scrivi un
breve motivo; **la squadra vede questo testo** nella sua chat
giocatore, quindi sii onesto e specifico. Esempi che funzionano:
«Troppo scuro, rifate vicino al lampione», «Fontana sbagliata,
provate quella davanti alla chiesa», «Metà squadra manca».

Premi **Rifiuta & notifica** per confermare. La squadra riceve un
toast 👎, l’invio viene eliminato dallo storage e la missione
torna disponibile.

Se un giocatore ha caricato un selfie o una foto chat per sbaglio
al posto della foto missione, la vedrai anche sulla scheda; rifiuta
con «caricamento sbagliato» e la squadra può riprovare.

# Trasmettere a tutti

::shot:m-08-broadcast

Cambia il pannello destro su **Broadcast**. Scrivi un messaggio e
tocca **📢 Invia a tutti**. La finestra di chat di ogni squadra
riceve il messaggio contemporaneamente con un piccolo tag
«Broadcast» così sanno che non è rivolto solo a loro.

Utile per cose come:

- «5 minuti alla fine, tornate al punto d’incontro!»
- «Acquazzone breve, sentitevi liberi di entrare in un portico.»
- «Singhiozzo server, timer in pausa per due minuti, scusate.»

I feedback individuali vanno nella scheda **Chat**; broadcast è
per tutti.

# Chat per squadra

::shot:m-09-chat

La scheda predefinita del pannello destro è **Chat**, riferita
alla squadra attualmente selezionata nell’area principale. Scrivi
un messaggio, premi Invio o **Invia** e la squadra lo vede nella
sua chat giocatore.

Quando una squadra ti scrive, il badge della sua scheda chat si
illumina con un punto arancione. Passa alla squadra che ha scritto,
leggi il messaggio, rispondi. Il punto è per squadra; puoi avere
messaggi non letti da una squadra mentre la chat di un’altra è
davanti a te.

# Cose che non puoi fare senza la password

::shot:m-10-settings-gate

Ecco cosa vedi se tocchi l’ingranaggio **⚙** senza la password GM.
Tutto dietro questa porta è solo per admin:

- Aggiungere/rimuovere posizioni o missioni
- Modificare le regole
- Cambiare il modello QR o la password GM
- Aggiornare l’app

Se trovi una missione con info sbagliate o una regola da
cambiare, prendi nota e chiedi a chi gestisce la tua
installazione di aggiornarla tra una sessione e l’altra.

::part:2:Gestire partite Rail Adventure

Rail Adventure è il tipo di partita guidato da GPS. Invece di fare
missioni in un solo luogo, i giocatori camminano fisicamente tra
bersagli su una mappa, arrivano a ogni bersaglio e completano il
compito sul posto. Tutto ciò che sai da MiSSiONS continua ad
applicarsi — il dashboard, i chip squadra, la chat, il broadcast,
lo strumento di congelamento, la lightbox — ma la partita parte
diversamente e c’è una scheda **mappa** extra.

# Avviare una partita Rail Adventure

::shot:cr-01-landing

Tocca la tessera **Rail Adventure** in basso nella schermata iniziale
invece di una delle posizioni regolari. La tessera mostra
un’icona di corridore e un conteggio delle modalità Rail Adventure
disponibili sotto.

::shot:cr-02-game-select

La schermata di selezione partita per Rail Adventure funziona come quella
MiSSiONS, ma il menu a discesa è il selettore di **modalità
Rail Adventure** (Altstadt-Tour in questa demo) invece del selettore
modalità-per-posizione. Scegli una modalità, tocca **+ Nuova
partita** e l’app genera il QR + dashboard.

# Il dashboard Rail Adventure

::shot:cr-03-dashboard

Il layout del dashboard è identico a MiSSiONS — chip squadra in
alto, schede missione nell’area principale quando selezioni una
squadra, pannello chat/broadcast/mappa a destra. Le schede Chat e
Broadcast funzionano esattamente come per le partite MiSSiONS.

Le differenze sono tutte nelle **schede missione** e nella scheda
**🗺️ mappa**.

# Le missioni di una squadra Rail Adventure

::shot:cr-04-team-detail

Ogni scheda missione Rail Adventure assomiglia a una scheda MiSSiONS
con qualche extra:

- Un **numero di sequenza** a sinistra (`1`, `2`, `3`…): le
  missioni Rail Adventure sono ordinate e i giocatori le sbloccano una
  alla volta. Una squadra deve arrivare alla missione 1 prima
  che la missione 2 sia anche solo visibile.
- Un prefisso **⭐** sulle **missioni speciali**: non seguono la
  sequenza; i giocatori possono farle in qualsiasi momento da un
  pannello separato.
- Uno stato **❔** quando la squadra non è ancora arrivata,
  sostituito dal compito reale e da una UI Accetta/Rifiuta una
  volta sul posto e dopo invio di media o risposta.

Accettazione, rifiuto, lightbox e rotazione funzionano esattamente
come in MiSSiONS, vedi gli scatti m-04–m-07 nella Parte 1.

# Il pannello mappa

::shot:cr-05-map

Cambia il pannello destro su **🗺️** per vedere la mappa in
diretta. I marker sono i bersagli delle missioni, nell’ordine in
cui vengono percorsi. I puntini di posizione squadra appaiono
mentre si muovono (a patto che abbiano concesso il permesso di
posizione nella loro vista giocatore).

Le missioni speciali non appaiono sulla mappa, non hanno una
posizione fissa.

La mappa ha un **toggle a tutto schermo** (in alto a destra) per
espanderla all’area principale; tocca di nuovo per ripristinare.
Usa il pieno schermo quando vuoi vedere dove sono tutte le squadre
contemporaneamente.

> Le missioni speciali intenzionalmente non hanno un target GPS.
> Se ne hai configurata una senza coordinate, vive nel pannello
> ⭐ del giocatore, non su questa mappa.

# Congelare una squadra presa in foto (solo Rail Adventure)

::shot:cr-06-freeze

Il pulsante **❄ Congela** è una meccanica PvP esclusiva di
Rail Adventure costruita attorno al «preso in foto». Il flusso:

1. La squadra A avvista la squadra B sul percorso e la fotografa.
2. La squadra A ti invia quella foto come invio di missione (o
   via chat, a seconda di come hai configurato).
3. Verifichi che la squadra B sia davvero nella foto e accetti
   l’invio.
4. Apri il dettaglio della **squadra A** (il fotografo, che è il
   congelatore) e tocchi **❄ Congela**. Nella finestra, scegli
   **la squadra B** come bersaglio e una durata (1, 3, 5 o 10
   minuti), poi conferma.

La squadra attualmente selezionata nell’area principale è sempre
il **congelatore**; la finestra sceglie poi quale **altra**
squadra congelare. Non confondere: aprire prima il dettaglio
della squadra B significherebbe che la squadra B diventa il
congelatore, l’opposto di ciò che vuoi.

Mentre è congelata, la squadra B vede un overlay «siete
congelati, il GM vi scongelerà tra N minuti»; il loro timer si
ferma, non possono caricare nulla e non possono validare arrivi
ai bersagli. La squadra A ha usato il suo unico colpo di congelo
contro la squadra B (vedi sotto).

Questo è l’**unico** uso legittimo del pulsante di congelo. Non
usarlo come pausa neutra, punizione generica o per dare una
pausa a una squadra.

Perché solo Rail Adventure? Nelle partite MiSSiONS ogni squadra lavora
sulla propria lista in un solo luogo, quindi non c’è nulla da
prendersi a vicenda in foto. Le squadre Rail Adventure condividono un
percorso, ed è per questo che la meccanica «preso in foto»
esiste.

Promemoria sulla direzione della finestra: la apri dal dettaglio
del congelatore (squadra A nella storia sopra). La finestra
chiede poi quale altra squadra congelare (squadra B). La squadra
di cui stai vedendo il dettaglio non è mai quella che finisce
congelata. Tocca **Congela** per confermare. Le squadre si
scongelano automaticamente alla scadenza, o puoi
**Scongelarle** prima con il pulsante 🔥 che sostituisce il
pulsante di congelo mentre una squadra è congelata.

Ogni squadra può congelare un rivale **una sola volta per
coppia**: il selettore ingrigisce i rivali su cui il congelatore
ha già usato il suo colpo. È un’arma a uso singolo per coppia,
non un fastidio costante.

---

## Checklist fine partita (entrambe le modalità)

Quando il timer raggiunge zero (o tocchi **Termina partita**
prima), l’app:

- Mostra il tuo messaggio finale a ogni giocatore.
- Congela la classifica.
- Marca la partita come «terminata» nell’elenco dashboard.

Prima di andartene:

1. Fai una schermata della **Classifica** nel pannello destro,
   utile per la premiazione se non ti fidi che i giocatori
   ricordino.
2. Rifiuta o accetta tutti gli invii in attesa rimasti; non
   lasciarli appesi.
3. Se una squadra ha fatto un invio in malafede (fuori tema,
   inappropriato), tocca **Rifiuta** con un motivo; l’invio
   viene rimosso dallo storage.

Puoi lasciare il dashboard aperto e tornare più tardi; le
partite terminate restano nell’elenco sotto la loro posizione
(o sotto Rail Adventure).

---

## Esportare le foto e i video della partita

Una volta terminata la partita, l’icona **🎬** in alto a destra
del dashboard si illumina. Cliccala per aprire il pannello di
esportazione:

- **📦 Scarica ZIP (tutti i media)**: invia ogni foto e video
  accettato di ogni squadra al tuo browser come
  `missions-<game-id>.zip`. Dentro, ogni squadra ha la sua
  cartella con il selfie squadra e ogni invio approvato,
  nominati in ordine di accettazione per preservare la
  cronologia. È il deliverable d’archivio: dallo al cliente o
  conservalo.
- **🎬 Rendi collage foto**: avvia un rendering server-side di un
  singolo slideshow MP4. Ogni squadra ha una card titolo con il
  suo nome, seguita dalle foto accettate in ordine (circa due
  secondi per foto). I video **non** sono nel collage, solo nel
  zip, perché ri-codificare video squadra in slideshow rende il
  rendering molto più lungo. Una barra mostra lo stato; al
  termine l’MP4 si scarica automaticamente.

Qualche nota pratica:

- Il rendering gira sul server. Puoi chiudere la finestra una
  volta avviato; riaprirla più tardi riprende da dove era se il
  rendering è ancora in corso.
- Una partita tipica con 30–40 foto accettate renderizza in
  30–60 secondi.
- L’export copre **solo** i media accettati. Gli invii rifiutati
  sono già eliminati dallo storage al momento del rifiuto, non
  possono riapparire qui.
- Renderizzare di nuovo sostituisce il collage precedente. Il zip
  viene generato fresco a ogni download.

---

## Domande comuni

**Una squadra dice di aver caricato un video ma non appare
nulla.**
Controlla il dettaglio squadra; a volte un upload video fallisce
silenziosamente per cattiva connessione. Falli ricaricare dalla
scheda missione.

**Il telefono della squadra dice «congelato» ma non li ho mai
congelati.**
Un compagno di squadra potrebbe aver innescato un congelo
automatico (es. provando a inviare due volte di seguito). Il
dashboard mostra il congelo attivo e un pulsante 🔥 per
scongelarli.

**Una squadra è entrata nella partita sbagliata.**
Ogni partita ha il proprio URL/QR di accesso. Se hai dato il
codice sbagliato, termina quella partita (o ignorala) e falli
rientrare in quella giusta. Non c’è migrazione; devono
ricominciare.

**Una squadra Rail Adventure non vede la prossima missione.**
Probabilmente non sono arrivati fisicamente nel raggio del
bersaglio attuale. Controlla il pannello mappa; il loro punto
dovrebbe essere nel cerchio del bersaglio. Se lo è e la missione
non si sblocca, la precisione della loro posizione potrebbe
essere troppo scarsa; falli uscire all’aperto e aspettare
qualche secondo.

**I giocatori dicono di non vedere le missioni nella loro lingua.**
Ogni giocatore sceglie la propria lingua nella schermata di
accesso. Se è sbagliata sul suo dispositivo, tocca il pulsante
🌐 nella vista giocatore, non nel dashboard GM.

**Posso gestire due partite nello stesso luogo
contemporaneamente?**
Sì, il dashboard di ognuna è indipendente. Assicurati solo che
ogni squadra entri nell’ID partita corretto.
