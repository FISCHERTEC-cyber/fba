# CI-Security-Baseline – Abdeckung und offene Pflichten

Diese Änderung ergänzt `security-baseline.yml` mit `npm audit --audit-level=high` für das bestehende `package-lock.json` (einschließlich Entwicklungsabhängigkeiten). **Nicht verifiziert:** Ein erfolgreicher Workflowlauf auf dem PR-Commit fehlt. Advisory-Funde sind zu korrigieren und Tests/Build erneut auszuführen.

Offen: Git-Historie, Secrets, Server-/Provider-/Container-Konfiguration, npm-Skriptausführung, CI-Action-Pinning, SSRF-/Upload-/OCR-/E-Mail-Missbrauchstests sowie kontrollierter Merge-Schutz. Keine Aussage zu Branch-Protection oder DSGVO-Konformität aus dem Audit.
