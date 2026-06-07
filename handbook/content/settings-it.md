---
title: "Manuale delle impostazioni MiSSiONS"
subtitle: "Per gli amministratori con la password GM"
lang: it
manifest: settings-it
---

# Benvenuto

Questo manuale copre ogni schermata dietro la porta
**Impostazioni** dell’app MiSSiONS. È organizzato in tre parti:

- **Parte 1, Amministrazione.** Le parti non legate a un tipo
  di partita: la porta password, l’URL pubblico, la sicurezza,
  gli aggiornamenti e il modello QR da stampare per l’accesso
  dei giocatori.
- **Parte 2, Configurazione MiSSiONS.** Posizioni, modalità,
  missioni e le regole che i giocatori vedono in partita. È il
  grosso del lavoro quotidiano.
- **Parte 3, Configurazione Rail Adventure.** Un tipo di partita
  separato con proprie modalità, missioni mirate via GPS,
  indizi e missioni speciali.

Rail Adventure è volutamente separato, condivide il guscio delle
impostazioni ma ha la propria logica (target GPS, sequenze di
indizi, missioni speciali) che non si applica alle partite
MiSSiONS. Se ne usi solo uno dei due, puoi saltare l’altra
parte.

La password per entrare nelle impostazioni è in mano a chi ha
installato l’app e non va condivisa con leggerezza, chi la ha
può cambiare ogni regola, missione e la password stessa. Il
default dopo un’installazione pulita è `admin1898`; cambialo
nella scheda Sicurezza appena possibile.

> Le schermate in questo manuale sono state catturate su un
> database demo pulito con tre posizioni (Altstadt, Stadtpark,
> Hauptbahnhof), sei missioni e una modalità Rail Adventure con tre
> missioni. La tua installazione reale avrà lo stesso aspetto
> ma con i tuoi dati.

::part:1:Amministrazione

# La porta password

::shot:adm-01-gate

Tocca l’icona ingranaggio in alto a destra della schermata
iniziale. Vedrai la porta password sopra. Scrivi la password GM
e premi **Sblocca** (o Invio). Password sbagliata? Il campo
trema e un errore rosso compare sotto. Premi **Indietro** per
tornare alla schermata iniziale.

Ogni scheda delle impostazioni sta dietro questa porta, quindi
chi non vuoi che abbia accesso admin completo non dovrebbe avere
la password.

# Generale

::shot:adm-02-general

**URL pubblico.** L’indirizzo che i giocatori usano per
raggiungere la tua partita. Quando avvii `start-tunnel-windows.bat`,
il quick tunnel Cloudflare in dotazione stampa un URL come
`https://abc-def-ghi.trycloudflare.com`. Clicca **Rileva** e
l’app lo trova automaticamente. Puoi anche incollarlo manualmente
se ospiti l’app diversamente.

**Messaggio di fine partita.** Quando il timer di una partita
scade, questo messaggio viene mostrato a ogni giocatore. Scrivilo
una volta per lingua, il pulsante **🌐 Auto** riempie le lingue
vuote da quella in cui hai cominciato. Salva prima di lasciare la
scheda.

# Sicurezza

::shot:adm-03-security

Cambia la password GM. Scrivi la password attuale, poi la nuova
due volte. La nuova password ha effetto immediato e si applica a
ogni operatore su ogni dispositivo, assicurati di avere un modo
per comunicarla prima di cambiarla.

# Aggiornamenti

::shot:adm-04-updates

L’app può aggiornarsi direttamente da GitHub. Imposta una volta
l’**URL del repository GitHub** (es.
`https://github.com/tu/missions-app`); il campo **Versione**
mostra la versione attualmente installata. Premi **Aggiorna
adesso** e l’app esegue `git pull && npm install --production` e
si riavvia. L’output appare nel riquadro sotto per confermare
cosa è cambiato.

**Attenzione a farlo in mezzo a una partita in corso**, il
riavvio scollegherà brevemente ogni giocatore. Si riconnettono
automaticamente, ma è comunque disruptivo. Aggiorna tra una
sessione e l’altra, non durante.

# Modello QR

::shot:adm-05-template

Per le posizioni dove stampi tessere d’accesso fisiche (un
foglio piegato con il tuo branding e un QR code), carica qui il
PNG del modello e trascina il marker QR arancione dove il
codice deve atterrare. Scegli prima un formato carta, A4 di
default. **Salva posizione** persiste il marker, e **Elimina
modello** azzera il caricamento. Quando un GM crea una nuova
partita, il QR viene reso su questo modello nella posizione che
hai impostato.

::part:2:Configurazione MiSSiONS

# Posizioni

::shot:m-01-locations

Una **posizione** è un luogo fisico dove si svolgono le partite.
La demo iniziata ha tre: Altstadt, Stadtpark e Hauptbahnhof.
Ogni posizione ha la propria libreria di missioni, quando un GM
avvia una partita a «Altstadt», i giocatori ricevono le missioni
di Altstadt più eventuali missioni del **Pool** (missioni non
legate a una posizione specifica).

Usa il pulsante **+ Posizione** (in cima all’elenco) per
aggiungerne una. Clicca **Modifica** su una scheda per cambiare
nome o regole. **Elimina** rimuove la posizione e **tutte le sue
missioni**, conferma con attenzione.

::shot:m-02-locations-add

La finestra Aggiungi posizione:

- **Nome**: cosa il GM vede scegliendo una posizione.
- **Min. MiSSiONS di posizione**: all’avvio di una partita, il
  motore garantisce questo numero di missioni prese da questa
  posizione (il resto viene dal pool). Usalo per fare in modo
  che le partite siano sempre adatte alla posizione.
- **Permetti foto / video / interno**: se missioni di questi
  tipi possono essere selezionate da questa posizione.
  Disattivare «interno» è utile per posizioni esclusivamente
  all’aperto con meteo affidabile.

# Modalità e libreria missioni

::shot:m-03-missions

La libreria missioni è divisa per **modalità** (la barra in
alto, MiSSiONS, ADVANCED, ecc.) e per **posizione** (il menu a
discesa). Una missione appartiene a esattamente una modalità e
a una sola posizione o al Pool globale.

**Schede modalità.** Ogni modalità è una libreria di missioni
separata legata a un insieme di regole e un timer. Clicca
**+ Modalità** per aggiungerne una. Clicca ✎ per modificare nome,
insieme regole o durata di default di una modalità. La prima
modalità («MiSSiONS», id 1) non può essere eliminata, è il
default sicuro.

**Filtro posizione.** «Tutte» mostra tutto nella modalità
corrente; scegli una posizione per vedere solo le sue missioni;
**Pool** mostra solo le missioni globali della modalità senza
posizione.

**Azioni multiple.** Spunta le caselle sulle missioni, poi usa
la barra che compare: **Copia in modalità…** per duplicare
missioni in un’altra modalità, o **Esporta** per scaricare un
file JSON importabile altrove.

**Importa.** Il pulsante **⬆ Importa** legge un file JSON con la
stessa forma prodotta da Esporta, utile per spostare missioni
tra installazioni.

::shot:m-04-mission-add

Ogni missione ha cinque campi lingua per nome, descrizione e
compito. Non provare a riempirli tutti e cinque a mano, scrivi
una lingua bene, poi clicca **🌐 Auto** in cima alla sezione
nome per riempire le altre automaticamente. Modifica dopo se la
traduzione richiede rifinitura.

- **Posizione**: limita la missione a una posizione (o lascia su
  Pool per qualsiasi).
- **Modalità**: di solito preselezionata su quella che stavi
  vedendo.
- **Tipo media**: foto o video. I giocatori saranno bloccati in
  quel formato all’invio.
- **Punti**: quanti punti riceve la squadra all’approvazione
  dell’invio. Le penalità per caricamenti in ritardo vengono
  sottratte da questi.
- **Anche interno**: imposta quando la missione si può fare al
  chiuso (missioni di backup pioggia). Le posizioni con
  «permetti interno» disattivato salteranno queste anche se sono
  nella modalità.

Le schede **Descrizione** e **Compito**:

- **Descrizione** è la storia/contesto mostrata sopra il
  pulsante fotocamera.
- **Compito** è l’istruzione esplicita «fai questo», tienila
  breve.

Clicca **Salva** quando hai finito. La missione appare
nell’elenco immediatamente.

# Regole

::shot:m-05-rules

Un **insieme regole** è una lista di regole mostrata ai
giocatori nella finestra Regole in partita. Lo **Standard**
iniziato non può essere eliminato, ma puoi aggiungerne altri
(es. una variante family-friendly) e assegnare regole diverse a
modalità diverse.

Per ogni riga di regola puoi usare i placeholder `[photo]`,
`[video]`, `[indoor]`, che si espandono in piccole icone nella
vista giocatore. Trascina le regole in su/giù per riordinare; il
pulsante 🌐 su una regola la auto-traduce; il pulsante ⎘ copia
una regola in un altro insieme. Premi **Salva** quando finito,
le modifiche non salvate sono evidenziate.

::part:3:Configurazione Rail Adventure

Rail Adventure è un tipo di partita separato. I giocatori camminano
fisicamente verso marker su una mappa, arrivano a ogni
bersaglio e completano un compito lì. Il pannello impostazioni
Rail Adventure rispecchia il layout di MiSSiONS ma con campi extra per
missione per coordinate, sequenze di indizi e missioni speciali.
Modalità e missioni configurate qui sono **solo** offerte quando
il GM avvia una partita Rail Adventure, non compaiono nelle partite
MiSSiONS e viceversa.

# Modalità Rail Adventure

::shot:cr-01-modes-empty

La scheda Rail Adventure funziona come la scheda MiSSiONS: una riga di
schede modalità in alto, poi le missioni appartenenti alla
modalità attiva sotto. Clicca **+ Modalità** a destra della
barra modalità per creare una nuova modalità Rail Adventure.

::shot:cr-02-mode-add

Una modalità Rail Adventure porta:

- **Nome**: cosa il GM sceglie dal menu a discesa all’avvio di
  una partita.
- **Insieme regole**: lo stesso elenco di MiSSiONS, ma le regole
  si applicano alle partite di questa modalità.
- **Media consentiti**: foto, video o entrambi. Influisce su
  quali missioni per tipo di media sono permesse in questa
  modalità.
- **Durata default (minuti)**: il timer di partenza.

# Missioni Rail Adventure

::shot:cr-03-mission-add

Una missione Rail Adventure ha ogni campo che ha una missione MiSSiONS,
più gli extra consapevoli della posizione:

- **Coordinate GPS + raggio**: dove si trova il bersaglio e a
  quale distanza (metri) i giocatori devono arrivare prima che
  il compito si sblocchi. Usa un raggio piccolo (15–25 m) in
  isolati densi; più grande (40–60 m) in parchi aperti.
- **Mostra sulla mappa**: se il marker bersaglio è visibile ai
  giocatori. Disattiva per missioni «trova la strada solo con
  gli indizi».
- **Indizi GPS**: rivelati uno per uno mentre la squadra
  cammina; utili quando il marker è nascosto o l’area è
  grande.
- **Indizi compito**: rivelati uno per uno dopo l’arrivo,
  quando le squadre sono bloccate sul compito stesso.
- **Media richiesto**: foto o video; mutuamente esclusivo con
  il campo risposta sotto.
- **Cronometrato**: quando una squadra tocca «Avvia», parte un
  conto alla rovescia. Scattano penalità se viene superato;
  configura l’intervallo penalità e i punti appena sotto.

## Missioni a modalità risposta

::shot:cr-04-mission-answer

Attiva **Ha risposta** per trasformare la missione in una sfida
«scrivi la parola giusta». Il campo **Risposta/e** accetta una
lista separata da `|` e ignora maiuscole/minuscole e spazi,
quindi `Eule|Owl|Hibou|Civetta` matchano tutte. Mutuamente
esclusivo con foto/video, scegli una modalità per missione.

## Missioni speciali

::shot:cr-05-mission-special

Attiva **Missione speciale** per togliere la missione dalla
sequenza lineare. Le missioni speciali:

- Compaiono nel pannello ⭐ del giocatore, giocabili in
  qualsiasi momento e ordine.
- Saltano del tutto lo step di arrivo GPS, anche se imposti
  coordinate.
- Usano un **Cooldown** (minuti) per limitare i ritentativi:
  `0` significa che ogni squadra può giocarla solo una volta;
  `5` significa cinque minuti tra tentativi. Un rifiuto GM
  azzera il cooldown subito.

Salva quando hai finito. I giocatori che hanno già iniziato una
partita non vedranno le missioni aggiunte a metà partita,
spingile prima del lancio.

---

## Consigli per l’uso quotidiano

- Usa **Traduci automaticamente** liberamente sia su missioni
  MiSSiONS che Rail Adventure, avere tutte e cinque le lingue
  perfette a mano è una rottura che l’IA fa abbastanza bene
  nella maggior parte dei casi.
- Le **missioni Pool** (solo MiSSiONS) sono **riempitivo**, non
  un backup pioggia. Restano missioni all’aperto, la differenza
  è che non sono legate a una posizione specifica, quindi il
  motore le può attingere in qualsiasi partita per completare
  una modalità che altrimenti avrebbe troppo poche missioni
  specifiche per posizione. Usa il flag **Anche interno** sulle
  singole missioni se le vuoi giocabili col maltempo; è una
  proprietà separata da Pool.
- Per Rail Adventure, **testa sempre il raggio a piedi**, il GPS in
  un telefono raramente è accurato entro 5 metri in zona
  costruita, e un raggio troppo stretto lascia le squadre
  bloccate.
- **Esporta le tue missioni ogni tanto** come backup. Il JSON è
  piccolo, leggibile e puoi reimportare dopo un wipe del
  database.
- **Non aggiornare a metà sessione.** Funziona, ma perderai la
  faccia davanti a chi sta giocando.
