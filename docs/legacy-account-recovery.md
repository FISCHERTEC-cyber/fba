# Wiederherstellung bestehender FBA-Konten

Alte Konten ohne `supabaseUserId` bleiben bei der Anmeldung gesperrt. Eine
übereinstimmende E-Mail-Adresse, ein Supabase-Login oder ein beliebiger
Datenbankeintrag allein ist kein unabhängiger Nachweis für die Berechtigung am
alten Konto. Die Anwendung verfügt derzeit über keinen nachgewiesenen zweiten
Nachweis und stellt deshalb weder Verknüpfungstokens noch einen automatischen
Wiederherstellungsendpunkt bereit.

Vor einer späteren kontrollierten Wiederherstellung müssen Verantwortliche ein
Verfahren festlegen und testen, das die Supabase-Identität serverseitig prüft
und die Berechtigung am konkreten Altbestand unabhängig davon nachweist.
Benötigt werden ein kurzlebiger, einmaliger, nur gehasht gespeicherter Nachweis,
atomare Einlösung, Schutz vor parallelen Versuchen und eine datensparsame
Protokollierung. Fehlversuche dürfen weder Kontodaten offenlegen noch den
Altbestand verändern.

Vor der Durchführung sind Identitäts- und Berechtigungsnachweise, Zugriff auf
die Verwaltungsumgebung, Rückfallverfahren und Datenschutzfristen zu prüfen.
Die Wiederherstellung ist vor Produktion mit synthetischen Daten einschließlich
Fremdzugriff, Ablauf, Wiederverwendung und paralleler Einlösung nachzuweisen.
Es gibt derzeit keine freigegebene manuelle Datenbankanweisung.
