## Zweck, betroffene Vertrauensgrenzen und Daten
- **Änderung und Nutzerwirkung:**
- **Betroffene APIs, Jobs, Datenbanken, Clients und Anbieter:**
- **Mandanten-/Objekt-/Rollenberechtigungen:**
- **Personenbezogene/vertrauenswürdige Daten und Verarbeitungszweck:**

## Security-Toolkit – 27 Punkte
Referenz: [projektspezifisches Kontrollregister](../docs/SECURITY_TOOLKIT_27_CONTROL_MATRIX.md). Jede Kontrollgruppe als geprüft, offen oder begründet N/A im PR beschreiben.

- [ ] 01–03 Authentifizierung, Secrets und objekt-/mandantensicherer Datenzugriff
- [ ] 04–07 TLS, Passwortverwaltung/IdP, serverseitige Validierung, XSS
- [ ] 08–10 Sicherheitslogging, Admin-/Job-Rechte, parametrisierte Abfragen
- [ ] 11–14 Umgebungsvariablen, Rate Limiting, CORS, Security-Header
- [ ] 15–17 Sessions/Token, CSRF, Reset-Prozess (soweit anwendbar)
- [ ] 18–20 Dateien/Uploads, serverseitige Preise/Werte und Zahlungswebhooks (falls vorhanden), sichere Fehlerausgabe
- [ ] 21–25 Dependency-/Container-/Actions- und Git-History-Scanning, ungenutzte Pakete, öffentliche Dateien, Secret-Rotation
- [ ] 26–27 Review, reproduzierbare positive/negative Tests und Befundbericht

## Datenschutz und externe Abhängigkeiten
- [ ] Zweck, Rechtsgrundlage, Datenminimierung und Privacy by Default überprüft, gegebenenfalls Inventar aktualisiert
- [ ] Lösch-/Auskunfts-/Export-/Widerrufs-/Backup-/Offline-Auswirkungen und DSFA-Bedarf geprüft oder begründet N/A
- [ ] Provider, Rechte, Speicherorte, Auftragsverarbeitung, Transfergrundlagen und Exit-Konzept geprüft oder begründet N/A

## Prüfevidenz / Freigabe
- **Commit und Testumgebung:**
- **CI-Checks und genaue Ergebnislinks:**
- **Positive/negative Tests (fremder Mandant, fremdes Objekt, Lesen/Schreiben, Ablauf/Widerruf, Rollback):**
- **Security-Funde (Schwere, Codepfad, Status), offene Punkte:**
- **Risikoeigentümer, Datum, Ablaufdatum und kompensierende Maßnahmen bei Ausnahmen:**
- **Migrations-/Rollback-/Wiederherstellungsplan:**
- **Fachliche und Security-Prüfende:**
- **Merge-/Deploy-Entscheidung:**

> Eine abgehakte Vorlage ist kein bestandener Test und kein Merge-Schutz. Fehlende oder kritische Nachweise bleiben Freigabesperren. Keine Secrets oder personenbezogenen Originaldaten einfügen.
