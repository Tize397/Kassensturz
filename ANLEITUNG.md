# Kassensturz aufs Android-Handy bringen

Die App muss einmal kostenlos ins Netz, damit Chrome sie installieren kann.
Deine Finanzdaten landen dabei nicht im Netz: Hochgeladen wird nur die leere App.
Alles, was du einträgst, bleibt auf dem Handy.

Am bequemsten geht das am Computer (ca. 10 Minuten).

## 1. GitHub-Konto anlegen
- github.com öffnen und kostenlos registrieren („Sign up“).

## 2. Projekt anlegen und Dateien hochladen
1. Oben rechts auf „+“ → „New repository“.
2. Name: `kassensturz`, Sichtbarkeit „Public“, dann „Create repository“.
3. Auf „uploading an existing file“ klicken.
4. Alle Dateien aus diesem ZIP hineinziehen (index.html, app.js, sw.js, version.json, manifest.webmanifest und alle fünf Icons).
5. Unten auf „Commit changes“.

## 3. Als Webseite freischalten
1. Im Projekt auf „Settings“ → links „Pages“.
2. Bei „Branch“ `main` und `/ (root)` wählen, dann „Save“.
3. Nach 1–2 Minuten steht oben die Adresse, z. B. `https://deinname.github.io/kassensturz/`.

## 4. Auf dem Handy installieren
1. Die Adresse in Chrome auf dem Handy öffnen.
2. Menü (⋮) → „App installieren“ (oder unter „Mehr“ in der App auf „App installieren“).
3. Kassensturz liegt jetzt auf dem Startbildschirm und läuft auch offline.

## 5. Daten aus der Browser-Version übernehmen (optional)
1. In der alten Version unter „Regeln“ → „Backup erstellen“ → „Kopieren“.
2. In der App unter „Mehr“ → „Oder Backup-Text einfügen“ → „Wiederherstellen“.

## Kurzbefehle auf den Startbildschirm legen
1. Lange auf das Kassensturz-Icon drücken.
2. Es erscheinen „Bon fotografieren“ und „Schnelleingabe“.
3. Einen davon gedrückt halten und auf den Startbildschirm ziehen. Ein Tipp darauf öffnet direkt die Fotoauswahl bzw. das Schnelleingabe-Feld.

## Tipps
- Bon-Foto direkt teilen: In der Galerie auf „Teilen“ → „Kassensturz“. Du kannst auch mehrere Fotos oder PDFs auf einmal markieren, die App geht sie dann nacheinander durch.
- Die Fotoerkennung lädt beim ersten Mal einmalig deutsche Sprachdaten (Internet nötig).
- Unter „Mehr“ regelmäßig „Backup herunterladen“ und die Datei z. B. in Google Drive legen.
- Updates: Bei einer neuen Version alle Dateien aus dem ZIP bei GitHub erneut hochladen (vorhandene ersetzen). Die App zeigt danach „Neue Version verfügbar“, ein Tipp auf „Jetzt laden“ genügt. Deine Daten bleiben erhalten.

## Sicherheit
- Schalte bei GitHub die Zwei-Faktor-Anmeldung ein (Settings → Password and authentication). Wer dein GitHub-Konto hat, könnte die App verändern.
- App-Sperre und verschlüsselte Backups findest du in der App unter „Mehr“.
- Die App darf nur mit jsDelivr (für die Texterkennung) Verbindung aufnehmen. Alle anderen Server sind gesperrt.
