# FISCHERTEC – Security-Toolkit: 27 Kontrollen und Projektabnahme

Stand: 2026-11-10. **Status: Arbeits- und Prüfregister, keine Sicherheitsfreigabe.**

Grundlage: „Security-Toolkit vor dem Launch“, Dawid Przybylski, 27 Punkte (Seiten 2–5); fachliche Konkretisierung durch OWASP ASVS 5.0.0 und OWASP Top 10:2025.
Referenzen: https://asvs.owasp.org/ ; https://top10.owasp.org/2025/ ; https://cheatsheetseries.owasp.org/ .

**Geltung:** Dieses Projekt, Erweiterungen, Refactorings, mobile Clients, automatisierte Jobs, Datenmigrationen und neue Integrationen. Für zukünftige FISCHERTEC-Apps ist dieses Register mit eigenem Nachweisstand neu anzulegen. Weder das Vorhandensein dieser Datei noch ein erfolgreiches Audit allein belegt Sicherheit oder DSGVO-Konformität.

**Kontrollstatus je Zeile:** OFFEN, GEPRÜFT (mit Commit, Test und Datum), BEHOBEN (mit Fix und Regressionstest), N/A (fachlich und technisch begründet) oder AUSNAHME (mit Verantwortlichem, Ablaufdatum und kompensierenden Maßnahmen). Ohne konkreten Nachweis bleibt der Status OFFEN. „In CI vorgesehen“ ist kein „bestanden“. Personenbezogene Testdaten dürfen nicht in den Bericht.

## 27 Kontrollen: Nachweise für die Abnahme

| Nr. | Prüfthema | Anwendbarkeit und erforderlicher Nachweis |
|---:|---|---|
| 01 | Authentifizierung | Alle privaten APIs, HTML/RSC-Views, Background-Jobs und Provider-Endpunkte; serverseitige Prüfung, einschließlich Negativtests |
| 02 | API-Keys und Secrets | Keine Credentials im Frontend, in Bundles, Antworten, Logs, Testfixtures oder Git; kontrollierte Secret-Verwaltung |
| 03 | Datenbankschutz | Least-Privilege, Objekt-/Mandantenrechte vor jedem Zugriff und in Transaktionen; RLS dort, wo Architektur und Datenzugriff es erfordern; Cross-Tenant-DB-Tests |
| 04 | HTTPS und HSTS | Öffentliche Endpunkte TLS-gesichert, Redirect und HSTS nach Host-/Subdomain-Prüfung; Reverse-Proxy und lokale Ausnahmen dokumentieren |
| 05 | Passwortspeicherung | Wenn App selbst Passwörter speichert: Argon2id oder fachlich begründetes starkes Verfahren; bei IdP/Supabase Auth dessen Konfiguration und Verantwortlichkeit prüfen |
| 06 | Serverseitige Validierung | Typen, Grenzen, Dateigrößen, Formate, fachliche Invarianten und Autorisierung serverseitig; ungültige Eingaben negativ testen |
| 07 | XSS-Schutz | Kontextgerechtes Output-Encoding, kein unkontrolliertes HTML, sichere HTML-Bereinigung nur wenn nötig; CSP ergänzen |
| 08 | Sicherheitslogging | Abgelehnte Zugriffe, Rollenänderungen und verdächtige Ereignisse mit Alarmierung; keine Tokens, Gesundheits-/Kunden- oder privaten Medieninhalte in Logs |
| 09 | Adminzugriff | Admin- und Job-Endpunkte bei jeder Anfrage serverseitig autorisieren; keine reinen Frontend-Rollenprüfungen |
| 10 | SQL-Injection | Gebundene Parameter/ORM, auch für Filter, Sortierung und dynamische SQL-Teile; Negativtests |
| 11 | Env-Konfiguration | Keine echten .env-Dateien in Git; .env.example nur mit Dummywerten; Build-/Runtime-Freigaben und Secret-Rotation prüfen |
| 12 | Rate-Limiting | Login, Reset, Upload, Import, Suche, teure Provider-/KI-Aufrufe und Jobs; Missbrauchs- und 429-Tests |
| 13 | CORS | Explizite Origins, keine reflexive Freigabe; CORS ist kein Authentifizierungsersatz; prüfen, ob CORS überhaupt nötig ist |
| 14 | Security-Header | CSP, HSTS, nosniff, Referrer-Policy, frame-ancestors passend zu App/IdP/Integrationen; HTTP-Response nach Deployment prüfen |
| 15 | Sessions/Cookies | HttpOnly/Secure/SameSite für echte Session-Cookies, TTL, Rotation, Logout, Widerruf und Gerätewechsel; OAuth-/Token-Flüsse gesondert testen |
| 16 | CSRF | Für zustandsändernde browserbasierte Aktionen Herkunftsprüfung und geeignete CSRF-Abwehr; SameSite alleine ist nicht generell hinreichend |
| 17 | Passwort-Reset | Nur bei vorhandener Reset-Funktion; kurze TTL, Einmalnutzung, kryptografische Zufälligkeit und IdP-Prozess prüfen |
| 18 | Uploads | Nur wenn vorhanden; Inhalt/MIME, Maximalgröße, sichere Ablage ohne Ausführung, Abrufrechte, Malware-/Parsing-Risiken, Datenschutz |
| 19 | Preise/Zahlungen | Bei Preis-, Wert- oder Zahlungsfunktionen: serverseitige Berechnung und Rechte; Signatur/Idempotenz nur für tatsächlich genutzte Zahlungswebhooks |
| 20 | Debug/Fehler | Keine Stacktraces, internen IDs, SQL-Texte und Geheimnisse in produktiven Antworten; diagnostische Logs abgesichert |
| 21 | Dependencies | Vollständige Lockfile-/Python-/Container-/Actions-Prüfung nach Stack, kritische Advisories beheben und Update-Regressionen testen |
| 22 | Unnötige Pakete | Laufzeit-/Dev-Abhängigkeiten inventarisieren; belegbar unbenötigte Pakete kontrolliert entfernen |
| 23 | Öffentliche Dateien | .git, .env, Dumps, Backups, Sourcemaps, Debug-, Preview- und Adminpfade von außen negativ prüfen |
| 24 | Git-Historie | Secret-Scan der gesamten History mit Fundbehandlung; kein pauschaler Schluss aus Pattern-Scan des aktuellen Checkout |
| 25 | Schlüsselrotation | Bei kompromittiertem Secret zuerst sperren/ersetzen, Nutzungs- und Logprüfung, dann Repository/History bereinigen |
| 26 | Review | OWASP Top 10:2025 plus ASVS-gestützte Prüfung mit Risiko, Fundort, Angriffspfad, Verantwortlichem und Entscheid |
| 27 | Test und Bericht | Positive/negative Integrationstests; Version, Umgebung, Commit, Ergebnis, Restrisiko und explizite Merge-/Deployentscheidung |

## Ergänzende FISCHERTEC-Pflichten

- **Sicherheitsarchitektur:** Datenfluss-/Vertrauensgrenzen, Threat Model, Least Privilege, Rollen- und Objektprüfung einschließlich Widerruf innerhalb kritischer Transaktionen, Schutz gegen SSRF und unsichere Deserialisierung/Importe.
- **Datenschutz:** Art.-6-Grundlage und Zweck je Datenart klären; Datenminimierung und Default-Privatsphäre, Lösch-/Exportprozesse, Backup-/Offline-Kopien, Auftragsverarbeiter, Drittlandtransfers, DSFA-Bedarf, Betroffenenrechte getrennt nach Anspruch prüfen.
- **Supply Chain und Infrastruktur:** Workflow-Mindestberechtigungen, vertrauenswürdige/pinnbare Actions, Scans für Container und IaC, Reproduzierbarkeit, SBOM nach Bedarf, Backups samt Restore-Test, Incident Response und Meldungsweg.
- **Freigabe:** Keine automatischen Merges, keine Produktionsänderungen durch dieses Register; kritische Befunde und nicht bestandene erforderliche Checks blockieren. Risikoausnahmen müssen Eigentümer, Ablauf, Begründung, kompensierende Kontrollen und Freigabe enthalten; gesetzliche Pflichten sind nicht abwählbar.

## Projektspezifische Prüfpakete
### FBA – Benefit Agent (Next.js, Prisma, Supabase Auth, OCR/E-Mail, Wallet)
**Priorität P0:** Sessions/Gerätelimit, Rollen und Besitzrechte in Familien-Wallet sowie widerrufene Freigaben serverseitig für Lesen, Import, Einlösen, Export und Löschung negativ testen. Eingehende E-Mail-Webhooks, Job-Tokens und OCR-Provider auf Authentifizierung, Replay/Idempotenz, Rate Limits, SSRF und Secret-Offenlegung prüfen.
**P1:** Uploads von Bild/PDF (im README 10 MiB), Parser/Decoder und gespeicherte Originale auf Inhalt, Privatsphäre, Löschfristen und Zugriff testen. Gutschein-Restwert/Teil-Einlösung ausschließlich serverseitig berechnen, transaktional gegen Doppelverwendung absichern. Merchant-Crawler einschließlich DNS-Rebinding, Redirects und Retry, Output-HTML sowie Provider-Verträge prüfen. Bestehenden PR #3 zur Datenportabilität, Familien-Wallet und Löschungen gesondert abnehmen.
**Bedingt/N/A:** Gutscheinwerte sind keine Zahlungswebhooks; Signaturpflicht nur bei tatsächlich vorhandenen Zahlungs-/Inbound-Webhooks. Eigene Passwort-Hash-/Reset-Logik prüfen, soweit Supabase Auth sie nicht übernimmt.
**Abnahme:** Kein automatischer Merge; es wurden keine Live-Webhooks/Provider ausgelöst.
