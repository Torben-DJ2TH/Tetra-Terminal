# TETRA Terminal

Diese HTML/JavaScript-Anwendung steuert ein Tetra Amateurfunkgerät direkt aus dem Browser über die Web Serial API. Neben einer Reihe fester AT-Befehle bietet das Tool umfassende Unterstützung für SDS und GPS.



![Screen1](https://github.com/user-attachments/assets/be4a466a-5389-49f0-93c3-fb24446eb753)



## Funktionsumfang

* **Serielle Verbindung mit wählbarer Baudrate** – beim Klick auf *Verbinden* wird die Schnittstelle geöffnet und das Terminal automatisch initialisiert.
* **Vordefinierte AT-Befehle** – Buttons senden z. B. `AT+CSQ?`, `AT+CTOM`, `AT+CTGS` usw. Die Signalstärke wird dabei in dBm umgerechnet und im Log sowie als Verlaufsgrafik dargestellt.
* **Manuelle Befehle** – jedes beliebige AT-Kommando kann direkt eingegeben werden.
* **TNP1-Profile** – alle Service-Profile lassen sich auf einmal oder einzeln aktivieren.
* **SDS-Funktionen**
  * Versand von Text-, Flash- und Status-SDS
  * Senden von LIP-, Long‑LIP- und LRRP-Paketen
  * Abfrage der GPS-Position anderer ISSIs (einmalig oder im Intervall)
  * automatische Empfangsbestätigung (ACK) – kann per Checkbox deaktiviert werden
* **Kartendarstellung** – empfangene Koordinaten werden auf einer OpenStreetMap-Karte markiert.
* **HamnetDB-Marker** – ausgewählte Relaisstandorte lassen sich importieren und werden in der IndexedDB gespeichert.
* **RSSI-Diagramm** – ein Chart zeigt den zeitlichen Verlauf der Signalstärke.
* **IndexedDB-Logging**
  * Speicherung aller gesendeten Befehle, SDS- und GPS-Daten
  * Filter- und Sortiermöglichkeiten in einer Tabelle
  * Export als CSV oder JSON sowie Import von JSON
  * Leeren der Datenbank bei Bedarf
* **Umschaltbarer Darkmode** – optional dunkles Farbschema

## Initiale Konfiguration

Nach dem Verbinden werden automatisch diverse AT-Befehle ausgeführt, unter anderem `ATE0`, `AT+CSCS="8859-1"`, mehrere `AT+CTSP`-Parameter sowie `AT+CTGL=0,0,1`. Eine ausführliche Liste befindet sich im Quellcode der Datei `serial.js`.

## Nutzung

Die benötigten Leaflet- und Chart.js-Dateien liegen nun im Verzeichnis `libs` und werden lokal eingebunden.

`index.html` kann lokal im Browser (Chrome/Edge) geöffnet werden. Alle Files müssen von einem localem Webserver ausgeliefert werden und an dem Rechner muss natürlich auch das Tetragerät angeschlossen sein. Nach Wahl der gewünschten Baudrate startet der Klick auf *Verbinden* die Kommunikation und lädt alle Komponenten wie Karte, Loganzeige und Diagramm. Danach stehen sowohl die vordefinierten als auch manuelle Befehle und alle SDS-Funktionen zur Verfügung.

## Web‑Parser

Der Parser nutzt jetzt eine WebSocket-Verbindung (`wss://core01.tmo.services/ws.io`) und empfängt die Daten in Echtzeit. Die bisherigen HTTP‑Abrufe über Codetabs oder AllOrigins entfallen damit.

## Offline-Funktionen

Durch einen Service Worker werden grundlegende Offline-Fähigkeiten bereitgestellt.
Beim ersten Aufruf werden alle wesentlichen Skripte sowie benötigte Kartendaten
zwischengespeichert. OSM-Kacheln werden nach dem Prinzip „Cache first“ geladen,
so dass bereits abgerufene Tiles auch ohne Netzwerkverbindung verfügbar sind.

## DAPNET TCP Anbindung

Die DAPNET‑Nachrichten können nun direkt im Browser empfangen werden.
Dazu wird eine WebSocket‑Verbindung zur DAPNET‑Infrastruktur
aufgebaut, ein separates Node‑Script ist nicht mehr nötig. Als URL
kann beispielsweise `wss://www.hampager.de/api/ws` angegeben werden.
Nach dem Öffnen der Verbindung wird das Login in der Form
`[DAPNETGateway v1.0 &lt;callsign&gt; &lt;authKey&gt;]` gesendet. Danach
werden eingehende POCSAG‑Nachrichten sofort im Textfeld und im
Browser‑Log angezeigt.


## Quellen

* [Leaflet](https://leafletjs.com)
* [Chart.js](https://www.chartjs.org)
* [OpenStreetMap](https://www.openstreetmap.org) – Kartendaten
* [Flaticon](https://www.flaticon.com) – Haus-Icon
* [DAPNET](https://www.hampager.de)
* [HamnetDB](https://hamnetdb.net) (über `https://r.jina.ai`)
* [core01.tmo.services](https://core01.tmo.services)

## Copyright

© 2025 DJ2TH / Torben Hahlbeck. Die Nutzung und Weitergabe dieses Projekts ist für
nicht kommerzielle Zwecke gestattet. Bitte die Nutzungsregeln der Exterenquellen eigenständig erfragen und beachten.
Fragen und Anregungen bitte an dj2th@darc.de

