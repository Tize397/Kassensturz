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
4. Alle Dateien und die Ordner `ki` und `tests` aus diesem ZIP hineinziehen (index.html, die sechs Programmdateien daten.js, erkennung.js, ki.js, ki-worker.js, ansichten.js und app.js, sw.js, version.json, manifest.webmanifest und alle fünf Icons).
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
- Unter „Mehr → Backup & Export“ regelmäßig „Backup teilen“ und z. B. Google Drive wählen. Die App erinnert dich, wenn das letzte Backup älter als einen Monat ist.
- Updates: Bei einer neuen Version alle Dateien aus dem ZIP bei GitHub erneut hochladen (vorhandene ersetzen). Eine alte Datei `icon-text-192.png` kannst du bei GitHub löschen, sie wird nicht mehr gebraucht. Die App zeigt danach „Neue Version verfügbar“, ein Tipp auf „Jetzt laden“ genügt. Deine Daten bleiben erhalten.

## Neu in 2.13: Flüssiger Start
- Die KI lädt und rechnet jetzt in einem eigenen Hintergrund-Prozess (neue Datei `ki-worker.js`). Die App ist direkt nach dem Start bedienbar und hakt auch nicht mehr, während ein Bon gelesen wird.
- **Hochladen:** Die neue Datei `ki-worker.js` gehört ins Hauptverzeichnis, neben `ki.js`. Den Ordner `ki` nicht erneut hochladen.

## Neu in 2.12: Schnellere KI
- **Früher fertig:** Die KI liest den Bon von oben nach unten und hört auf, sobald Summe, Positionen und Datum zusammenpassen. Kassenbons gehen dadurch etwa ein Drittel bis die Hälfte schneller. Rechnungen ohne Datum dauern so lange wie bisher.
- **Mehrere Belege:** Während du einen Beleg prüfst, liest die App den nächsten schon im Hintergrund.
- **Hochladen:** Nur die Programmdateien ersetzen. Den Ordner `ki` musst du nicht erneut hochladen.

## Neu in 2.11: KI-Texterkennung
- Eine kleine KI (PaddleOCR) liest Bon-Fotos direkt auf dem Handy. Sie ist deutlich genauer als die bisherige Erkennung, besonders bei blassem Thermopapier.
- **Datenschutz:** Die KI rechnet komplett im Handy. Fotos und Text werden nirgendwohin geschickt. Die Modelldateien liegen im Ordner `ki` deiner eigenen GitHub-Seite.
- **Laden:** Einmalig ca. 24 MB, automatisch im Hintergrund und nur im WLAN. Danach bleibt sie dauerhaft im Handy, auch über App-Updates hinweg, und funktioniert offline.
- **Speicher:** etwa 25–30 MB zusätzlich (zu sehen unter den Website-Daten von Chrome).
- **Rückfallebene:** Ist die KI (noch) nicht geladen oder geht ihr Ergebnis nicht auf, liest die bisherige Erkennung mit. Das Ergebnis, das rechnerisch aufgeht, gewinnt.
- **Hochladen:** Den Ordner `ki` mit allen sechs Dateien bei GitHub mit hochladen. Fehlt er, läuft die App ohne KI weiter.
- Unter „Mehr → Entwickler-Werkzeuge“ lässt sich die KI zum Vergleichen abschalten.

## Neu in 2.10
- **Lernen aus Korrekturen:** Verbesserst du beim Prüfen eines Belegs einen verlesenen Namen, setzt die App ihn beim selben Händler künftig selbst ein. Löschst du eine Störzeile, lässt sie die beim nächsten Mal weg. Steht bei einem Händler der Name unter dem Preis, merkt sie sich das. Alles einsehbar und löschbar unter „Mehr → Kategorien & Gelerntes → Lesekorrekturen“.
- **Entwickler-Werkzeuge** (nur für dich, ab Werk aus): Unter „Mehr → Entwickler-Werkzeuge“ einschalten. Dann erscheint beim Prüfen eines Belegs „Bericht speichern“. Erst korrigieren, dann speichern. Gesammelte Berichte teilst du dort gesammelt, z. B. an Claude. Sie enthalten den kompletten Belegtext, auf Wunsch auch das Foto.

## Neu in 2.9
- **Sparziele & Rücklagen** sind ein Bereich unter „Planen“. Beim Anlegen wählst du, was es sein soll. Der Schalter für Rücklagen unter „Mehr“ entfällt.
- **„Mehr“ aufgeräumt:** „Kategorien & Gelerntes“ und „Backup & Export“ fassen je zwei Bereiche zusammen.
- **Hinweise im Monat:** Sind es mehrere, stehen sie gebündelt in einer Zeile. Dringende (rot) bleiben sichtbar.
- **Wiederkehrende Ausgaben:** Kommt derselbe Betrag beim selben Händler drei Monate in Folge, schlägt die App vor, ihn als Fixkosten zu übernehmen.
- **Speicher:** Deine Daten liegen jetzt in der Datenbank des Browsers, zusätzlich als zweite Kopie im bisherigen Speicher. Beide gehören nur zu deiner App, der Schutz ist derselbe wie vorher. Beim ersten Start von 2.9 werden deine Daten automatisch übernommen.
- **Tests:** Unter `…/kassensturz/tests/pruefen.html` siehst du, ob die Belegerkennung alle Beispiel-Bons richtig liest. Die Seite enthält nur erfundene Bons.

## Neu in 2.8
- **Bon-Fotos:** Die App dreht schiefe oder quer aufgenommene Bons selbst gerade. Liegt sie einmal falsch, hilft „Drehen und neu lesen“ über dem Händler-Feld. Gelb markierte Beträge bitte mit dem Bon vergleichen.
- **Sicherheitskopie:** Unter „Mehr → Backup & Export“ liegen automatisch die letzten drei Stände. Das hilft bei Fehlern, ersetzt aber kein Backup: Geht das Handy verloren, sind auch die Kopien weg.
- **Kassensturz:** Unter „Mehr“ einschalten. Dann im Reiter „Monat“ den Kontostand vom Monatsende eintragen. Die App zeigt, wie viel Geld du nicht erfasst hast. Bei einer Differenz fragt sie nach Bargeld im Portemonnaie und vergessenen Einträgen. Ab welchem Betrag sie nachfragt, stellst du unter „Mehr → Kassensturz“ ein.
- **Jahresrückblick:** Im Reiter „Verlauf“ ganz oben unter dem Diagramm.

## Sicherheit
- Schalte bei GitHub die Zwei-Faktor-Anmeldung ein (Settings → Password and authentication). Wer dein GitHub-Konto hat, könnte die App verändern.
- App-Sperre und verschlüsselte Backups findest du in der App unter „Mehr“.
- Die App darf nur mit jsDelivr (für Texterkennung, PDF- und QR-Leser) Verbindung aufnehmen. Alle anderen Server sind gesperrt.
