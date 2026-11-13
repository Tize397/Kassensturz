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
- Bon-Foto direkt teilen: In der Galerie auf „Teilen“ → „Kassensturz“. Du kannst auch mehrere Fotos oder PDFs auf einmal markieren, die App geht sie dann nacheinander durch. Sind es Seiten einer einzigen Rechnung (z. B. mehrere Screenshots), wähle „Seiten einer Rechnung zusammenfügen“. Noch besser: Online-Rechnungen als PDF teilen, die liest die App ohne Lesefehler. Hat eine Rechnung einen GiroCode (QR-Code zum Überweisen) oder ein Kassenbon einen QR-Code, liest die App Betrag (und beim Bon Datum und Zahlungsart) direkt daraus. Achte darauf, dass der Code mit aufs Foto kommt.
- Die Fotoerkennung lädt beim ersten Mal einmalig deutsche Sprachdaten (Internet nötig).
- Unter „Mehr“ regelmäßig „Backup herunterladen“ und die Datei z. B. in Google Drive legen.
- Updates: Bei einer neuen Version alle Dateien aus dem ZIP bei GitHub erneut hochladen (vorhandene ersetzen). Die App zeigt danach „Neue Version verfügbar“, ein Tipp auf „Jetzt laden“ genügt. Deine Daten bleiben erhalten.

## Neu in 2.8
- **Bon-Fotos:** Die App dreht schiefe oder quer aufgenommene Bons selbst gerade. Liegt sie einmal falsch, hilft „Drehen und neu lesen“ über dem Händler-Feld. Gelb markierte Beträge bitte mit dem Bon vergleichen.
- **Sicherheitskopie:** Unter „Mehr → Backup & Daten“ liegen automatisch die letzten drei Stände. Das hilft bei Fehlern, ersetzt aber kein Backup: Geht das Handy verloren, sind auch die Kopien weg.
- **Kassensturz:** Unter „Mehr“ einschalten. Dann im Reiter „Monat“ den Kontostand vom Monatsende eintragen. Die App zeigt, wie viel Geld du nicht erfasst hast.
- **Rücklagen:** Unter „Mehr“ einschalten, dann unter „Planen“ Töpfe anlegen. Beim Beleg wählst du „Bezahlt aus“ und die Rücklage.
- **Jahresrückblick:** Im Reiter „Verlauf“ ganz oben unter dem Diagramm.

## Sicherheit
- Schalte bei GitHub die Zwei-Faktor-Anmeldung ein (Settings → Password and authentication). Wer dein GitHub-Konto hat, könnte die App verändern.
- App-Sperre und verschlüsselte Backups findest du in der App unter „Mehr“.
- Die App darf nur mit jsDelivr (für Texterkennung, PDF- und QR-Leser) Verbindung aufnehmen. Alle anderen Server sind gesperrt.
